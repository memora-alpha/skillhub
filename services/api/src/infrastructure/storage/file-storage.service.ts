import { randomUUID, createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import type { Actor } from "../../shared/authorization/authorization.types";
import type { SystemConfigurationService } from "../../modules/system-configuration/application/system-configuration.service";
import { FileFormatDetector } from "./file-format-detector";
import { validateFile } from "./file-policy";
import { FileStorageError, type FilePurpose } from "./file.types";
import type { ObjectStorage } from "./object-storage.port";
import type { StoredFileRepository } from "./stored-file.repository";

export interface FileAccessPolicy {
  assertRead(input: {
    actor: Actor;
    fileId: string;
    resource: { type: string; id: string };
  }): Promise<void>;
}

export class FileStorageService {
  constructor(
    private readonly repository: StoredFileRepository,
    private readonly objects: ObjectStorage,
    private readonly configuration: Pick<
      SystemConfigurationService,
      "getSnapshot"
    >,
    private readonly detector = new FileFormatDetector(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async upload(input: {
    actor: Actor;
    purpose: FilePurpose;
    name: string;
    claimedMime: string;
    body: Readable;
    context: { correlationId: string };
  }): Promise<{ fileId: string; state: "QUARANTINED" }> {
    const cap =
      input.purpose === "CHAT"
        ? 15_000_000
        : (await this.configuration.getSnapshot(["storage.evidenceMaxBytes"]))
            .values["storage.evidenceMaxBytes"];
    if (!cap || !Number.isSafeInteger(cap) || cap <= 0) {
      throw new FileStorageError("FILE_POLICY_UNAVAILABLE", 503);
    }
    validateFile({
      purpose: input.purpose,
      name: input.name,
      claimedMime: input.claimedMime,
      detectedMime: input.claimedMime,
      sizeBytes: 1,
      capBytes: cap,
    });
    const fileId = randomUUID();
    const objectKey = `private/${fileId}`;
    await this.repository.createUploading({
      id: fileId,
      purpose: input.purpose,
      uploadedBy: input.actor.userId,
      objectKey,
      generation: 1,
      originalName: input.name,
    });
    let uploadedSize = 0;
    const uploadHash = createHash("sha256");
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        uploadedSize += chunk.length;
        if (uploadedSize > cap)
          callback(new FileStorageError("FILE_TOO_LARGE", 413));
        else {
          uploadHash.update(chunk);
          callback(null, chunk);
        }
      },
    });
    try {
      await this.objects.put(
        objectKey,
        input.body.pipe(meter),
        "application/octet-stream",
      );
      if (uploadedSize === 0)
        throw new FileStorageError("FILE_EMPTY_OR_INVALID", 400);
      const object = await this.objects.head(objectKey);
      if (!object || object.size !== uploadedSize)
        throw new FileStorageError("FILE_OBJECT_MISMATCH", 503);
      const inspected = await this.detector.inspect({
        body: await this.objects.read(objectKey),
        name: input.name,
        purpose: input.purpose,
        capBytes: cap,
      });
      validateFile({
        purpose: input.purpose,
        name: input.name,
        claimedMime: input.claimedMime,
        detectedMime: inspected.detectedMime,
        sizeBytes: inspected.sizeBytes,
        capBytes: cap,
      });
      if (
        inspected.sizeBytes !== uploadedSize ||
        inspected.sha256 !== uploadHash.digest("hex")
      ) {
        throw new FileStorageError("FILE_OBJECT_MISMATCH", 503);
      }
      await this.repository.finalize({
        id: fileId,
        generation: 1,
        detectedMime: inspected.detectedMime,
        sizeBytes: inspected.sizeBytes,
        sha256: inspected.sha256,
        correlationId: input.context.correlationId,
      });
      return { fileId, state: "QUARANTINED" };
    } catch (error) {
      await this.repository.failUpload(fileId).catch(() => undefined);
      throw error;
    }
  }

  async issueDownload(
    input: {
      actor: Actor;
      fileId: string;
      resource: { type: string; id: string };
    },
    policy: FileAccessPolicy,
  ): Promise<{ url: string; expiresAt: Date }> {
    try {
      await policy.assertRead(input);
    } catch {
      throw new FileStorageError("FILE_NOT_FOUND", 404);
    }
    const row = await this.repository.find(input.fileId);
    if (!row) throw new FileStorageError("FILE_NOT_FOUND", 404);
    if (row.state !== "READY")
      throw new FileStorageError("FILE_NOT_READY", 409);
    if (!row.detectedMime || !row.sizeBytes)
      throw new FileStorageError("FILE_NOT_READY", 409);
    const object = await this.objects.head(row.objectKey);
    if (object?.size !== row.sizeBytes)
      throw new FileStorageError("FILE_OBJECT_MISMATCH", 503);
    const ttl = (
      await this.configuration.getSnapshot(["storage.downloadTtlSeconds"])
    ).values["storage.downloadTtlSeconds"];
    const ascii =
      row.originalName
        .replace(/[^a-zA-Z0-9._-]/gu, "_")
        .replace(/^\.+/u, "file")
        .slice(0, 100) || "file";
    const disposition = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`;
    const url = await this.objects.signGet(row.objectKey, {
      expiresInSeconds: ttl,
      disposition,
      mime: row.detectedMime,
    });
    const now = this.now();
    return { url, expiresAt: new Date(now.getTime() + ttl * 1_000) };
  }
}
