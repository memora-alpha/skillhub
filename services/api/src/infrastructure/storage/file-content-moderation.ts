import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Prisma } from "../../generated/prisma/client";
import {
  ContentModerationService,
  type ModerationAssessment,
} from "../../modules/content-moderation/application/content-moderation.service";
import {
  MediaModerationService,
  type MediaModerationInput,
} from "../../modules/content-moderation/application/media-moderation.service";
import { PrismaService } from "../database/prisma.service";
import { FileStorageError } from "./file.types";
import { OBJECT_STORAGE, type ObjectStorage } from "./object-storage.port";
import { MATERIAL_MAX_BYTES } from "./file-policy";
import { prepareChatImage } from "./chat-image";
import { moderationPolicyVersion } from "../../modules/content-moderation/domain/moderation-policy";
import {
  chatAttachmentRetry,
  chatModerationRevision,
} from "./chat-attachment-policy";

type FileState = {
  state: string;
  purpose: string;
  generation: number;
  sha256: string | null;
  moderationAssessment?: Prisma.JsonValue;
};

export const fileScanQueue = "file-scan";
export const fileScanBackoff = { type: "file-processing" };
export const moderationRetryCode = "FILE_MODERATION_RETRY";
const extractorRevision = chatModerationRevision;

function surface(purpose: string) {
  return purpose === "REPORT" ? "report_evidence" : "media";
}

function currentOutcome(
  row: FileState,
  version: number,
  enforce: boolean,
): string | undefined {
  const value = row.moderationAssessment;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  if (
    row.purpose === "CHAT" &&
    row.sha256 &&
    value.digest === row.sha256 &&
    value.sourceVersion === String(row.generation) &&
    value.outcome === "BLOCK"
  )
    return "BLOCK";
  if (
    value.sourceVersion !== String(row.generation) ||
    value.digest !== row.sha256 ||
    value.profanityVersion !== version ||
    (row.purpose === "CHAT" &&
      (value.policyVersion !== moderationPolicyVersion ||
        value.extractorRevision !== extractorRevision)) ||
    (enforce && value.enforced !== true) ||
    (value.outcome === "REVIEW" &&
      value.extractorRevision !== extractorRevision)
  )
    return undefined;
  return typeof value.outcome === "string" ? value.outcome : undefined;
}

@Injectable()
export class FileContentModeration {
  private readonly logger = new Logger(FileContentModeration.name);
  constructor(
    private readonly db: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
    private readonly moderation: ContentModerationService,
    private readonly media: MediaModerationService,
    @Optional() @InjectQueue(fileScanQueue) private readonly queue?: Queue,
  ) {}

  status(row: FileState, version = 1): string {
    if (row.state !== "READY" || row.purpose === "REPORT") return row.state;
    const outcome = currentOutcome(row, version, this.enforces(row));
    if (outcome === "ALLOW") return "READY";
    if (outcome === "BLOCK") return "REJECTED";
    if (outcome === "RETRY" || outcome === "FAILED") return "SCAN_FAILED";
    return "QUARANTINED";
  }

  async resolveStatus(row: FileState & { id: string }): Promise<string> {
    return (await this.resolveStatusDetails(row)).state;
  }

  async resolveStatusDetails(row: FileState & { id: string }) {
    if (row.state !== "READY" || row.purpose === "REPORT")
      return { state: row.state };
    const version = await this.profanityVersion();
    const outcome = currentOutcome(row, version, this.enforces(row));
    if (!outcome) {
      await this.enqueueRecheck(row, version);
      return { state: "QUARANTINED", moderationStatus: "PENDING" };
    }
    const state = this.status(row, version);
    if (outcome === "REVIEW")
      return { state, moderationStatus: "REVIEW_REQUIRED" };
    if (state === "SCAN_FAILED") return { state, moderationStatus: "FAILED" };
    return { state };
  }

  async profanityVersion(): Promise<number> {
    return (await this.moderation.profanityVersion?.()) ?? 1;
  }

  private enforces(row: FileState): boolean {
    return this.moderation.mode?.(surface(row.purpose)) === "enforce";
  }

  private async enqueueRecheck(
    row: FileState & { id: string },
    version: number,
  ): Promise<void> {
    const retry = chatAttachmentRetry(row.moderationAssessment);
    await this.queue?.add(
      "scan",
      {
        fileId: row.id,
        generation: row.generation,
        finalizedAt: retry?.queuedAt,
        retryAttemptId: retry?.id,
      },
      {
        jobId: `moderation-${row.id}-${row.generation}-${version}-${extractorRevision}-${this.enforces(row)}${retry ? `-${retry.id}` : ""}`,
        attempts: row.purpose === "CHAT" ? 3 : 5,
        priority: 15,
        backoff: fileScanBackoff,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async recheckLegacyChatFiles() {
    if (!this.queue || this.moderation.mode("media") !== "enforce") return;
    const version = await this.profanityVersion();
    const rows = await this.db.$queryRaw<(FileState & { id: string })[]>`
      SELECT id, purpose, generation, state, sha256, moderation_assessment AS "moderationAssessment"
      FROM stored_files WHERE purpose = 'CHAT' AND state = 'READY' AND scan_verdict = 'CLEAN'
        AND resource_type = 'CHAT_MESSAGE'
        AND ((moderation_assessment IS NOT NULL AND moderation_assessment ->> 'retryAttemptId' IS NULL)
          OR updated_at < CURRENT_TIMESTAMP - interval '125 seconds')
        AND moderation_assessment ->> 'outcome' IS DISTINCT FROM 'BLOCK'
        AND (moderation_assessment ->> 'extractorRevision' IS DISTINCT FROM ${String(extractorRevision)}
          OR moderation_assessment ->> 'profanityVersion' IS DISTINCT FROM ${String(version)}
          OR moderation_assessment ->> 'policyVersion' IS DISTINCT FROM ${moderationPolicyVersion}
          OR moderation_assessment ->> 'enforced' IS DISTINCT FROM 'true')
      ORDER BY scanned_at NULLS LAST, id LIMIT 20`;
    await Promise.all(rows.map((row) => this.enqueueRecheck(row, version)));
    await this.db.$executeRaw`
      DELETE FROM chat_content_verdict_cache WHERE cache_key IN (
        SELECT cache_key FROM chat_content_verdict_cache WHERE expires_at < CURRENT_TIMESTAMP - interval '1 day'
        ORDER BY expires_at LIMIT 200
      )`;
  }

  async assertShareable(row: FileState & { id: string }): Promise<void> {
    const status = await this.resolveStatus(row);
    if (status === "REJECTED")
      throw new FileStorageError("CONTENT_MODERATION_BLOCKED", 409);
    if (status !== "READY") {
      throw new FileStorageError("FILE_NOT_READY", 409);
    }
  }

  async process(
    fileId: string,
    generation: number,
    finalAttempt = false,
    signal = AbortSignal.timeout(120_000),
    attempt = 1,
    queuedAt?: number,
    retryAttemptId?: string,
  ): Promise<void> {
    const select = await this.db.storedFile.findUnique({
      where: { id: fileId },
    });
    if (
      !select ||
      select.generation !== generation ||
      select.state !== "READY" ||
      chatAttachmentRetry(select.moderationAssessment)?.id !== retryAttemptId
    )
      return;
    let pdfDeadline: number | undefined;
    if (
      select.purpose === "CHAT" &&
      select.detectedMime === "application/pdf" &&
      queuedAt !== undefined
    ) {
      pdfDeadline = queuedAt + 120_000;
      const remaining = pdfDeadline - Date.now();
      signal = AbortSignal.any([
        signal,
        remaining > 0 ? AbortSignal.timeout(remaining) : AbortSignal.abort(),
      ]);
    }
    if (select.purpose !== "CHAT" || !this.db.$executeRaw)
      return this.processReady(
        fileId,
        generation,
        finalAttempt,
        signal,
        attempt,
        select,
        pdfDeadline,
        retryAttemptId,
      );

    const key = `file:${fileId}:${generation}`;
    const token = randomUUID();
    const claimed = await this.db.$executeRaw`
      INSERT INTO chat_content_verdict_cache (cache_key, lease_token, expires_at)
      VALUES (${key}, ${token}::uuid, CURRENT_TIMESTAMP + interval '125 seconds')
      ON CONFLICT (cache_key) DO UPDATE SET lease_token = EXCLUDED.lease_token, expires_at = EXCLUDED.expires_at
      WHERE chat_content_verdict_cache.expires_at <= CURRENT_TIMESTAMP`;
    if (!claimed) throw new Error(moderationRetryCode);
    try {
      return await this.processReady(
        fileId,
        generation,
        finalAttempt,
        signal,
        attempt,
        await this.db.storedFile.findUnique({ where: { id: fileId } }),
        pdfDeadline,
        retryAttemptId,
      );
    } finally {
      await this.db
        .$executeRaw`DELETE FROM chat_content_verdict_cache WHERE cache_key = ${key} AND lease_token = ${token}::uuid`;
    }
  }

  private async processReady(
    fileId: string,
    generation: number,
    finalAttempt: boolean,
    signal: AbortSignal,
    attempt: number,
    row: Awaited<ReturnType<PrismaService["storedFile"]["findUnique"]>>,
    pdfDeadline?: number,
    retryAttemptId?: string,
  ): Promise<void> {
    const started = performance.now();
    if (
      !row ||
      row.generation !== generation ||
      row.state !== "READY" ||
      row.scanVerdict !== "CLEAN" ||
      !row.sha256 ||
      !row.detectedMime ||
      !row.sizeBytes ||
      chatAttachmentRetry(row.moderationAssessment)?.id !== retryAttemptId
    )
      return;
    const scope = surface(row.purpose);
    const mode = this.moderation.mode(scope);
    // Report evidence remains restricted to its own case. Enabling an AI mode for
    // general uploads never sends these bytes to the provider.
    if (scope === "report_evidence") return;
    const version = await this.profanityVersion();
    if (currentOutcome(row, version, mode === "enforce")) return;
    const bytes = signal.aborted
      ? undefined
      : await this.readExact(
          row.objectKey,
          row.sizeBytes,
          row.sha256,
          signal,
        ).catch(() => undefined);
    const readMs = Math.round(performance.now() - started);
    const failed: ModerationAssessment = {
      outcome: "RETRY",
      sourceVersion: String(generation),
      digest: row.sha256,
      reasonCodes: ["MEDIA_STORAGE_READ_FAILED"],
      policyVersion: moderationPolicyVersion,
    };
    const input =
      bytes &&
      ({
        surface: scope,
        version: String(generation),
        digest: row.sha256,
        mime: row.detectedMime,
        filename: row.originalName,
        bytes,
        maximumPdfPages: row.purpose === "CHAT" ? 50 : undefined,
        signal,
      } satisfies MediaModerationInput);
    const model = this.moderation.cacheModelVersion?.();
    const scanner = row.scannerVersion;
    const canCache =
      row.purpose === "CHAT" &&
      mode === "enforce" &&
      model &&
      scanner &&
      /^ClamAV [^/]+\/\d+\//u.test(scanner);
    const assessmentStarted = performance.now();
    const assessment = input
      ? await (
          canCache
            ? this.cachedAssessment(input, version, model, scanner)
            : this.media.assess(input)
        ).catch((error: unknown) => {
          if (
            signal.aborted ||
            (error instanceof Error && error.message === moderationRetryCode)
          )
            return {
              ...failed,
              reasonCodes: [
                signal.aborted
                  ? "MEDIA_PROCESSING_TIMEOUT"
                  : "MEDIA_CACHE_PENDING",
              ],
            };
          throw error;
        })
      : failed;
    if (signal.aborted) {
      assessment.outcome = "RETRY";
      assessment.reasonCodes = ["MEDIA_PROCESSING_TIMEOUT"];
    }
    if (version !== (await this.profanityVersion()))
      throw new Error(moderationRetryCode);
    const deadlineExpired = () =>
      pdfDeadline !== undefined && Date.now() >= pdfDeadline;
    const canRetry = () =>
      !finalAttempt &&
      !deadlineExpired() &&
      !(row.purpose === "CHAT" && attempt >= 3);
    if (assessment.outcome === "RETRY" && canRetry()) {
      this.logger.warn({
        fileId,
        generation,
        mode,
        outcome: "RETRY",
        reasonCodes: assessment.reasonCodes,
      });
      throw new Error(moderationRetryCode);
    }
    const technicalFailure =
      assessment.outcome === "REVIEW" &&
      assessment.reasonCodes?.some(
        (code) => code.startsWith("MEDIA_") || code.startsWith("MODERATION_"),
      );
    let outcome =
      technicalFailure || assessment.outcome === "RETRY"
        ? "FAILED"
        : assessment.outcome;
    const imageStarted = performance.now();
    const image =
      row.purpose === "CHAT" &&
      outcome === "ALLOW" &&
      mode === "enforce" &&
      bytes &&
      row.detectedMime.startsWith("image/")
        ? await prepareChatImage(
            this.objects,
            row.objectKey,
            bytes,
            signal,
          ).catch(() => {
            this.logger.warn({
              fileId,
              generation,
              outcome: "CHAT_IMAGE_VARIANT_FAILED",
            });
            return undefined;
          })
        : undefined;
    if (version !== (await this.profanityVersion()))
      throw new Error(moderationRetryCode);
    const write = (db: Pick<Prisma.TransactionClient, "storedFile">) => {
      if ((signal.aborted || deadlineExpired()) && outcome === "ALLOW") {
        if (canRetry()) throw new Error(moderationRetryCode);
        outcome = "FAILED";
        assessment.reasonCodes = ["MEDIA_PROCESSING_TIMEOUT"];
      }
      return db.storedFile.updateMany({
        where: {
          id: fileId,
          generation,
          sha256: row.sha256,
          state: "READY",
          scanVerdict: "CLEAN",
          moderationAssessment: {
            equals:
              row.moderationAssessment === null
                ? Prisma.DbNull
                : row.moderationAssessment,
          },
        },
        data: {
          moderationAssessment: {
            ...assessment,
            policyVersion: moderationPolicyVersion,
            ...(image && outcome === "ALLOW" && { image }),
            outcome,
            enforced: mode === "enforce",
            profanityVersion: version,
            extractorRevision,
          },
        },
      });
    };
    const lateApproval = new Error("CHAT_PDF_APPROVAL_DEADLINE");
    const written =
      pdfDeadline !== undefined && outcome === "ALLOW" && this.db.$transaction
        ? await this.db
            .$transaction(async (tx) => {
              await tx.$queryRaw`SELECT id FROM stored_files WHERE id = ${fileId}::uuid FOR UPDATE`;
              const result = await write(tx);
              if (outcome === "ALLOW" && (signal.aborted || deadlineExpired()))
                throw lateApproval;
              return result;
            })
            .catch((error: unknown) => {
              if (error !== lateApproval) throw error;
              return write(this.db);
            })
        : await write(this.db);
    if (written.count) {
      const [timing] = this.db.$queryRaw
        ? await this.db.$queryRaw<{ elapsed: number }[]>`
        SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - upload_finalized_at))::float8 * 1000 AS elapsed
        FROM stored_files WHERE id = ${fileId}::uuid AND upload_finalized_at IS NOT NULL`.catch(
            () => [],
          )
        : [];
      this.logger.log({
        fileId,
        generation,
        mime: row.detectedMime,
        mode,
        outcome,
        reasonCodes: assessment.reasonCodes,
        readMs,
        content_moderation_duration_ms: Math.round(
          imageStarted - assessmentStarted,
        ),
        image_variant_duration_ms: image
          ? Math.round(performance.now() - imageStarted)
          : undefined,
        elapsedMs: Math.round(performance.now() - started),
        total_moderation_duration_ms: timing?.elapsed,
        time_to_available_ms:
          outcome === "ALLOW" && mode === "enforce"
            ? timing?.elapsed
            : undefined,
        moderation_timeout: assessment.reasonCodes?.some((code) =>
          code.includes("TIMEOUT"),
        ),
        moderation_failure: outcome === "FAILED",
      });
    }
  }

  private async cachedAssessment(
    input: MediaModerationInput,
    version: number,
    model: string,
    scanner: string,
  ) {
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          input.digest,
          input.mime,
          input.surface,
          model,
          scanner,
          moderationPolicyVersion,
          version,
          extractorRevision,
        ]),
      )
      .digest("hex");
    const token = randomUUID();
    let claimed = 0;
    while (!claimed) {
      input.signal?.throwIfAborted();
      const [cached] = await this.db.$queryRaw<
        { verdict: ModerationAssessment }[]
      >`
        SELECT verdict FROM chat_content_verdict_cache WHERE cache_key = ${key}
        AND verdict IS NOT NULL AND expires_at > CURRENT_TIMESTAMP`;
      if (cached) {
        this.logger.log({
          metric: "cache_hit_rate",
          hit: true,
          surface: "chat",
        });
        const filename = await this.media.assessFilename(input);
        return this.media.combine(filename, {
          ...cached.verdict,
          sourceVersion: input.version,
        });
      }
      claimed = await this.db.$executeRaw`
        INSERT INTO chat_content_verdict_cache (cache_key, lease_token, expires_at)
        VALUES (${key}, ${token}::uuid, CURRENT_TIMESTAMP + interval '125 seconds')
        ON CONFLICT (cache_key) DO UPDATE SET lease_token = EXCLUDED.lease_token,
          expires_at = EXCLUDED.expires_at, verdict = NULL
        WHERE chat_content_verdict_cache.expires_at <= CURRENT_TIMESTAMP`;
      if (!claimed) await delay(250, undefined, { signal: input.signal });
    }
    this.logger.log({ metric: "cache_hit_rate", hit: false, surface: "chat" });
    try {
      const [filename, body] = await Promise.all([
        this.media.assessFilename(input),
        this.media.assess({ ...input, filename: undefined }),
      ]);
      input.signal?.throwIfAborted();
      if (body.outcome === "ALLOW" || body.outcome === "BLOCK") {
        await this.db
          .$executeRaw`UPDATE chat_content_verdict_cache SET verdict = ${JSON.stringify(body)}::jsonb,
          lease_token = NULL, expires_at = CURRENT_TIMESTAMP + interval '24 hours'
          WHERE cache_key = ${key} AND lease_token = ${token}::uuid`;
      }
      return this.media.combine(filename, body);
    } finally {
      await this.db
        .$executeRaw`DELETE FROM chat_content_verdict_cache WHERE cache_key = ${key} AND lease_token = ${token}::uuid`;
    }
  }

  private async readExact(
    key: string,
    bytes: number,
    checksum: string,
    signal: AbortSignal,
  ): Promise<Buffer> {
    if (bytes > MATERIAL_MAX_BYTES) throw new Error("MEDIA_SIZE_LIMIT");
    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    let size = 0;
    const stream = await this.objects.read(key, signal);
    const stop = () => stream.destroy(new Error("MEDIA_PROCESSING_TIMEOUT"));
    signal.addEventListener("abort", stop, { once: true });
    try {
      if (signal.aborted) stop();
      for await (const value of stream) {
        const chunk = Buffer.from(value as Uint8Array);
        size += chunk.length;
        if (size > bytes) throw new Error("MEDIA_VERSION_CHANGED");
        chunks.push(chunk);
        hash.update(chunk);
      }
    } finally {
      signal.removeEventListener("abort", stop);
    }
    if (size !== bytes || hash.digest("hex") !== checksum)
      throw new Error("MEDIA_VERSION_CHANGED");
    return Buffer.concat(chunks, size);
  }
}
