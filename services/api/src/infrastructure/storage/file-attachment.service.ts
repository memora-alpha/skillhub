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
