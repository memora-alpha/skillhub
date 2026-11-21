import { Inject, Injectable, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client";
import { ContentModerationService } from "../../modules/content-moderation/application/content-moderation.service";
import { MediaModerationService } from "../../modules/content-moderation/application/media-moderation.service";
import { PrismaService } from "../database/prisma.service";
import { FileStorageError } from "./file.types";
import { OBJECT_STORAGE, type ObjectStorage } from "./object-storage.port";
import { MATERIAL_MAX_BYTES } from "./file-policy";

type FileState = {
  state: string;
  purpose: string;
  generation: number;
  sha256: string | null;
  moderationAssessment?: Prisma.JsonValue;
};

export const fileScanQueue = "file-scan";

function surface(purpose: string) {
  return purpose === "REPORT" ? "report_evidence" : "media";
}

function currentOutcome(row: FileState, version: number): string | undefined {
  const value = row.moderationAssessment;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  if (
    value.sourceVersion !== String(row.generation) ||
    value.digest !== row.sha256 ||
    value.profanityVersion !== version
  )
    return undefined;
  return typeof value.outcome === "string" ? value.outcome : undefined;
}

@Injectable()
export class FileContentModeration {
  constructor(
    private readonly db: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
    private readonly moderation: ContentModerationService,
    private readonly media: MediaModerationService,
    @Optional() @InjectQueue(fileScanQueue) private readonly queue?: Queue,
  ) {}

  status(row: FileState, version = 1): string {
    if (row.state !== "READY" || row.purpose === "REPORT") return row.state;
    const outcome = currentOutcome(row, version);
    if (outcome === "ALLOW") return "READY";
    if (outcome === "BLOCK") return "REJECTED";
    return "QUARANTINED";
  }

  async resolveStatus(row: FileState & { id: string }): Promise<string> {
    if (row.state !== "READY" || row.purpose === "REPORT") return row.state;
    const version = await this.profanityVersion();
    if (!currentOutcome(row, version)) await this.enqueueRecheck(row, version);
    return this.status(row, version);
  }

  private async profanityVersion(): Promise<number> {
    return (await this.moderation.profanityVersion?.()) ?? 1;
  }

  private async enqueueRecheck(
    row: FileState & { id: string },
    version: number,
  ): Promise<void> {
    await this.queue?.add(
      "scan",
      { fileId: row.id, generation: row.generation },
      {
        jobId: `profanity-${row.id}-${row.generation}-${version}`,
        attempts: 5,
        backoff: { type: "fixed", delay: 65_000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async assertShareable(row: FileState & { id: string }): Promise<void> {
    const status = await this.resolveStatus(row);
    if (status === "REJECTED")
      throw new FileStorageError("CONTENT_MODERATION_BLOCKED", 409);
    if (status !== "READY") {
      throw new FileStorageError("FILE_NOT_READY", 409);
    }
  }

  async process(fileId: string, generation: number): Promise<void> {
    const row = await this.db.storedFile.findUnique({ where: { id: fileId } });
    if (
      !row ||
      row.generation !== generation ||
      row.state !== "READY" ||
      row.scanVerdict !== "CLEAN" ||
      !row.sha256 ||
      !row.detectedMime ||
      !row.sizeBytes
    )
      return;
    const scope = surface(row.purpose);
    const mode = this.moderation.mode(scope);
    // Report evidence remains restricted to its own case. Enabling an AI mode for
    // general uploads never sends these bytes to the provider.
    if (scope === "report_evidence") return;
    const version = await this.profanityVersion();
    if (currentOutcome(row, version)) return;
    const bytes = await this.readExact(
      row.objectKey,
      row.sizeBytes,
      row.sha256,
    ).catch(() => {
      throw new Error("FILE_MODERATION_RETRY");
    });
    const assessment = await this.media.assess({
      surface: scope,
      version: String(generation),
      digest: row.sha256,
      mime: row.detectedMime,
      filename: row.originalName,
      bytes,
    });
    if (
      assessment.outcome === "RETRY" ||
      version !== (await this.profanityVersion())
    )
      throw new Error("FILE_MODERATION_RETRY");
    await this.db.storedFile.updateMany({
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
          enforced: mode === "enforce",
          profanityVersion: version,
        },
      },
    });
  }

  private async readExact(
    key: string,
    bytes: number,
    checksum: string,
  ): Promise<Buffer> {
    if (bytes > MATERIAL_MAX_BYTES) throw new Error("MEDIA_SIZE_LIMIT");
    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    let size = 0;
    for await (const value of await this.objects.read(key)) {
      const chunk = Buffer.from(value as Uint8Array);
      size += chunk.length;
      if (size > bytes) throw new Error("MEDIA_VERSION_CHANGED");
      chunks.push(chunk);
      hash.update(chunk);
    }
    if (size !== bytes || hash.digest("hex") !== checksum)
      throw new Error("MEDIA_VERSION_CHANGED");
    return Buffer.concat(chunks, size);
  }
}
