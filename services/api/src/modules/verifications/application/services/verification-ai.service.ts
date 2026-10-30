import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { SkillCommand } from "../../../skills/application/contracts/skill-contracts";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { SharingSkillsService } from "../../../sharing-skills/application/services/sharing-skills.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import { OutboxWriter } from "../../../../infrastructure/events/outbox-writer";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import {
  auditActorFromActor,
  type AuditActor,
} from "../../../audit/application/contracts/audit.types";
import type { RequestContext } from "../../../../shared/http/request-context";
import type { Prisma } from "../../../../generated/prisma/client";
import { VerificationsRepository } from "../../infrastructure/persistence/verifications.repository";
import { VerificationAiRepository } from "../../infrastructure/persistence/verification-ai.repository";
import { VerificationAiContext, aiInputHash } from "./verification-ai.context";
import {
  VerificationAiProvider,
  type AiUsage,
} from "../ports/verification-ai.provider";
import {
  AI_EVENT,
  AI_MAX_ATTEMPTS,
  AI_PROMPT_VERSION,
  VERIFICATION_AI_CONFIG,
  VerificationAiError,
  type VerificationAiConfiguration,
} from "../../domain/verification-ai.config";
import {
  aggregateAiResults,
  aiSnapshotSchema,
  supportsAiSnapshot,
  type AiFileInput,
  type AiFileResult,
  type AiSnapshot,
} from "../../domain/verification-ai.types";

type AnalysisRow = Awaited<ReturnType<VerificationAiRepository["get"]>>;

@Injectable()
export class VerificationAiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VerificationAiService.name);
  private timer?: NodeJS.Timeout;
  private recovering?: Promise<void>;

  constructor(
    private readonly repository: VerificationAiRepository,
    private readonly verifications: VerificationsRepository,
    private readonly context: VerificationAiContext,
    private readonly sharing: SharingSkillsService,
    private readonly actors: SkillActorService,
    private readonly transactions: TransactionRunner,
    private readonly commands: IdempotencyService,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
    private readonly provider: VerificationAiProvider,
    private readonly outbox: OutboxWriter,
    private readonly audit: AuditWriter,
    @Inject(VERIFICATION_AI_CONFIG)
    private readonly config: VerificationAiConfiguration,
  ) {}

  onModuleInit() {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => {
      if (!this.recovering)
        this.recovering = this.recover()
          .catch(() => this.logger.error("Verification AI recovery failed"))
          .finally(() => {
            this.recovering = undefined;
          });
    }, 30000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.recovering;
  }

  /** Called by submission inside its existing PostgreSQL transaction. */
  async schedule(
    tx: TransactionContext,
    verificationId: string,
    requester: AuditActor | null,
    context: RequestContext,
  ) {
    if (!this.config.enabled) return null;
    await this.verifications.get(verificationId, tx, true);
    const input = await this.context.read(tx, verificationId);
    if (!input.eligible) {
      if (!requester) return null;
      throw new ConflictException("AI_VERIFICATION_NOT_PENDING");
    }
    const inputHash = aiInputHash(input.snapshot);
    const reused = await this.repository.reusable(
      tx,
      verificationId,
      inputHash,
      this.config.model,
      AI_PROMPT_VERSION,
    );
    if (reused) return reused;
    if (
      (await this.repository.count(tx, verificationId)) >= this.config.maxRuns
    )
      throw new ConflictException("AI_RUN_LIMIT_REACHED");
    const supported = supportsAiSnapshot(input.snapshot);
    const row = await this.repository.create(tx, {
      verificationId,
      inputHash,
      input: input.snapshot as Prisma.InputJsonObject,
      model: this.config.model,
      promptVersion: AI_PROMPT_VERSION,
      requestedByUserId: requester?.kind === "HUMAN" ? requester.userId : null,
      status: supported ? "QUEUED" : "UNSUPPORTED",
      errorCode: supported ? null : "AI_UNSUPPORTED_FORMAT",
      completedAt: supported ? null : new Date(),
    });
    await this.audit.append(tx, {
      actor: requester ?? { kind: "SYSTEM", name: "verification-ai" },
      action: "VERIFY_SKILL_AI_REQUEST",
      target: { type: "SKILL_VERIFICATION", id: verificationId },
      after: { analysisId: row.id, status: row.status },
      reason: "Request advisory AI analysis of submitted evidence",
      context,
    });
    if (supported) await this.enqueue(tx, row.id, context.correlationId);
    return row;
  }

  async request(
    command: SkillCommand,
    verificationId: string,
    expectedVersion: number,
  ) {
    // Authorize even when the provider is disabled; feature flags do not bypass RBAC.
    await this.transactions.run((tx) =>
      this.actors.require(tx, command.principal, "skill-verification:analyze"),
    );
    if (!this.config.enabled)
      throw new ServiceUnavailableException("AI_DISABLED");
    const initial = await this.verifications.get(verificationId);
    const shared = await this.sharing.read(initial.sharingSkillId);
    const result = await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: "skill-verification:analyze",
        key: command.key,
        command: { verificationId, expectedVersion },
      },
      async (tx) => {
        const actor = await this.actors.require(
          tx,
          command.principal,
          "skill-verification:analyze",
          [shared.userId],
        );
        await this.sharing.lock(tx, initial.sharingSkillId);
        const row = await this.verifications.get(verificationId, tx, true);
        if (row.version !== expectedVersion)
          throw new ConflictException("VERSION_CONFLICT");
        const analysis = await this.schedule(
          tx,
          verificationId,
          auditActorFromActor(actor),
          command.context,
        );
        if (!analysis) throw new ServiceUnavailableException("AI_DISABLED");
        return { id: analysis.id, status: analysis.status };
      },
      (tx) =>
        this.actors
          .require(tx, command.principal, "skill-verification:analyze", [
            shared.userId,
          ])
          .then(() => undefined),
    );
    return this.analysisView(await this.repository.get(result.value.id));
  }

  async read(principal: Principal, verificationId: string) {
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, "skill-verification:read");
      await this.verifications.get(verificationId, tx);
      const row = await this.repository.latest(verificationId, tx);
      if (!row) return { enabled: this.config.enabled, latest: null };
      const input = await this.context.read(tx, verificationId);
      return {
        enabled: this.config.enabled,
        latest: {
          ...this.analysisView(row),
          isStale: !this.matchesInput(input, row),
        },
      };
    });
  }

  private analysisView(row: AnalysisRow) {
    const input = aiSnapshotSchema.parse(row.input);
    return {
      id: row.id,
      verificationId: row.verificationId,
      status: row.status,
      model: row.model,
      promptVersion: row.promptVersion,
      attempts: row.attempts,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      errorCode: row.errorCode,
      context: {
        applicant: input.applicant,
        skill: input.skill,
        reviewPolicy: input.reviewPolicy,
      },
      result: row.result,
    };
  }

  async process(id: string): Promise<string> {
    if (!this.config.enabled) return "DISABLED";
    const leaseMs = 5 * (this.config.timeoutMs + 15000) + 30000;
    const row = await this.transactions.run((tx) =>
      this.repository.claim(tx, id, leaseMs),
    );
    if (!row?.leaseToken) return "IGNORED";
    try {
      const snapshot = aiSnapshotSchema.parse(row.input);
      const fresh = await this.transactions.run((tx) =>
        this.context.read(tx, row.verificationId),
      );
      if (!this.matchesInput(fresh, row)) {
        await this.transactions.run((tx) =>
          this.repository.finish(tx, id, row.leaseToken!, {
            status: "STALE",
            errorCode: "AI_INPUT_CHANGED",
          }),
        );
        return "STALE";
      }
      const result = await this.analyzeFiles(snapshot, row.createdAt);
      return await this.complete(row, result as Prisma.InputJsonObject);
    } catch (error) {
      return this.fail(row, error);
    }
  }

  private matchesInput(
    input: { snapshot: AiSnapshot; eligible: boolean },
    row: AnalysisRow,
  ) {
    return (
      input.eligible &&
      aiInputHash(input.snapshot) === row.inputHash &&
      row.model === this.config.model &&
      row.promptVersion === AI_PROMPT_VERSION
    );
  }

  private readFile(file: AiFileInput) {
    return this.storage.readEvidenceForAnalysis(file.storedFileId, () =>
      this.transactions.run(async (tx) => {
        const bound = await this.attachments.assertBoundReady(
          tx,
          file.storedFileId,
          { type: "SKILL_EVIDENCE", id: file.evidenceId },
        );
        if (
          bound.sha256 !== file.checksum ||
          bound.detectedMime !== file.mimeType ||
          bound.sizeBytes !== file.sizeBytes
        )
          throw new VerificationAiError("AI_FILE_CHANGED");
      }),
    );
  }

  private async analyzeFiles(snapshot: AiSnapshot, createdAt: Date) {
    const files: AiFileResult[] = [];
    const usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    // One provider request at a time bounds memory and provider concurrency per job.
    for (const file of snapshot.files) {
      const bytes = await this.readFile(file);
      const response = await this.provider.analyze({
        snapshot,
        file,
        bytes,
        currentDate: createdAt.toISOString().slice(0, 10),
      });
      files.push(response.result);
      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
      usage.totalTokens += response.usage.totalTokens;
    }
    return { ...aggregateAiResults(files), usage };
  }

  private complete(row: AnalysisRow, result: Prisma.InputJsonObject) {
    return this.transactions.run(async (tx) => {
      const current = await this.context.read(tx, row.verificationId);
      const stale = !this.matchesInput(current, row);
      const status = stale ? "STALE" : "SUCCEEDED";
      const applied = await this.repository.finish(
        tx,
        row.id,
        row.leaseToken!,
        {
          status,
          result,
          ...(stale ? { errorCode: "AI_INPUT_CHANGED" } : {}),
        },
      );
      return applied ? status : "IGNORED";
    });
  }

  private async fail(row: AnalysisRow, error: unknown) {
    const safe =
      error instanceof VerificationAiError
        ? error
        : new VerificationAiError("AI_ANALYSIS_FAILED", true);
    const retry = safe.retryable && row.attempts < AI_MAX_ATTEMPTS;
    const applied = await this.transactions.run((tx) =>
      this.repository.finish(tx, row.id, row.leaseToken!, {
        status: retry ? "QUEUED" : "FAILED",
        errorCode: safe.code,
      }),
    );
    if (applied && retry) throw new Error("AI_RETRY_PENDING");
    return "FAILED";
  }

  private enqueue(tx: TransactionContext, id: string, correlationId: string) {
    return this.outbox.append(tx, {
      eventId: randomUUID(),
      type: AI_EVENT,
      version: 1,
      payload: { analysisId: id },
      correlationId,
    });
  }

  async recover() {
    if (!this.config.enabled) return;
    await this.transactions.run(async (tx) => {
      const pending = await this.repository.recover(tx);
      // Outbox publication must be atomic with each recovered row in this transaction.
      for (const id of pending) await this.enqueue(tx, id, randomUUID());
    });
  }
}
