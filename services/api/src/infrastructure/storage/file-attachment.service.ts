import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { TransactionContext } from "../database/transaction-context";
import { FileStorageError } from "./file.types";
type Binding = {
  type: string;
  id: string;
  purpose?: "EVIDENCE" | "REPORT" | "MATERIAL";
};
@Injectable()
export class FileAttachmentService {
  constructor(private readonly db: PrismaService) {}
  async chatManifest(
    tx: TransactionContext,
    userId: string,
    ids: readonly string[],
    messageId: string,
    bind = false,
  ) {
    const result = [];
    for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
      await tx.$queryRaw`SELECT id FROM stored_files WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.storedFile.findUnique({ where: { id } });
      if (row?.uploadedBy !== userId || row.purpose !== "CHAT")
        throw new FileStorageError("FILE_NOT_FOUND", 404);
      if (
        row.state !== "READY" ||
        row.scanVerdict !== "CLEAN" ||
        !row.detectedMime ||
        !row.sha256 ||
        !row.sizeBytes ||
        row.sizeBytes > 15_000_000
      )
        throw new FileStorageError("FILE_NOT_READY", 409);
      if (
        row.attachedAt &&
        (row.resourceType !== "CHAT_MESSAGE" || row.resourceId !== messageId)
      )
        throw new FileStorageError("FILE_ALREADY_BOUND", 409);
      if (bind && !row.attachedAt)
        await tx.storedFile.update({
          where: { id },
          data: {
            attachedAt: new Date(),
            resourceType: "CHAT_MESSAGE",
            resourceId: messageId,
          },
        });
      result.push({
        fileId: row.id,
        generation: row.generation,
        filename: [...row.originalName]
          .map((char) =>
            char.codePointAt(0)! < 32 || char === "/" || char === "\\"
              ? "_"
              : char,
          )
          .join("")
          .slice(0, 150),
        mimeType: row.detectedMime,
        fileSizeBytes: row.sizeBytes,
        storageKey: row.objectKey,
        checksum: row.sha256,
      });
    }
    if (
      result.length > 5 ||
      result.reduce((total, file) => total + file.fileSizeBytes, 0) > 50_000_000
    )
      throw new FileStorageError("FILE_TOO_LARGE", 413);
    return result;
  }
  async chatStatus(userId: string, id: string) {
    const row = await this.db.storedFile.findUnique({ where: { id } });
    if (row?.uploadedBy !== userId || row.purpose !== "CHAT")
      throw new FileStorageError("FILE_NOT_FOUND", 404);
    return { fileId: row.id, state: row.state, generation: row.generation };
  }
  async status(actor: { userId: string }, id: string) {
    const row = await this.db.storedFile.findUnique({ where: { id } });
    if (
      row?.uploadedBy !== actor.userId ||
      (row.purpose !== "EVIDENCE" &&
        row.purpose !== "REPORT" &&
        row.purpose !== "MATERIAL")
    )
      throw new FileStorageError("FILE_NOT_FOUND", 404);
    return { fileId: row.id, state: row.state, generation: row.generation };
  }
  async attachReady(
    tx: TransactionContext,
    actor: { userId: string },
    id: string,
    resource: Binding,
  ) {
    await tx.$queryRaw`SELECT id FROM stored_files WHERE id=${id}::uuid FOR UPDATE`;
    const row = await tx.storedFile.findUnique({ where: { id } });
    if (
      row?.uploadedBy !== actor.userId ||
      row.purpose !== (resource.purpose ?? "EVIDENCE")
    )
      throw new FileStorageError("FILE_NOT_FOUND", 404);
    if (
      row.state !== "READY" ||
      row.scanVerdict !== "CLEAN" ||
      !row.sha256 ||
      !row.detectedMime ||
      !row.sizeBytes ||
      row.sizeBytes >
        (resource.purpose === "MATERIAL" ? 20_000_000 : 10_000_000) ||
      row.attachedAt
    )
      throw new FileStorageError("FILE_NOT_READY", 409);
    await tx.storedFile.update({
      where: { id },
      data: {
        attachedAt: new Date(),
        resourceType: resource.type,
        resourceId: resource.id,
      },
    });
    return {
      id: row.id,
      key: row.objectKey,
      originalName: row.originalName,
      mime: row.detectedMime,
      size: row.sizeBytes,
      checksum: row.sha256,
      uploadedAt: row.createdAt,
    };
  }
  async assertBoundReady(
    tx: TransactionContext,
    id: string,
    resource: Binding,
  ) {
    await tx.$queryRaw`SELECT id FROM stored_files WHERE id=${id}::uuid FOR UPDATE`;
    const row = await tx.storedFile.findUnique({ where: { id } });
    if (row?.resourceType !== resource.type || row.resourceId !== resource.id)
      throw new FileStorageError("FILE_NOT_FOUND", 404);
    if (row.state !== "READY" || row.scanVerdict !== "CLEAN")
      throw new FileStorageError("FILE_NOT_READY", 409);
    return row;
  }
}
