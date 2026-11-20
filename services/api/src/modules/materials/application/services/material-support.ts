import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { FileContentModeration } from "../../../../infrastructure/storage/file-content-moderation";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { assertPublishableFile } from "../../domain/material.policy";

// Re-exported so the materials services keep a single support import.
export {
  roleCodes,
  storageActor,
} from "../../../../shared/authorization/principal-actor";

export function requirePermission(
  principal: Principal,
  code: PermissionCode,
): void {
  if (!principal.permissions.includes(code))
    throw new ForbiddenException("MATERIAL_PERMISSION_REQUIRED");
}

export function isModerator(principal: Principal): boolean {
  return (
    principal.permissions.includes("material:moderate") &&
    (principal.roles.includes("STAFF") || principal.roles.includes("ADMIN"))
  );
}

export function requireModerator(principal: Principal): void {
  if (!isModerator(principal))
    throw new ForbiddenException("STAFF_ACCESS_REQUIRED");
}

export function auditContext() {
  return { requestId: randomUUID(), correlationId: randomUUID() };
}

/** Row lock serializes edits, moderation and purchases of one material. */
export async function lockMaterial(tx: TransactionContext, id: string) {
  await tx.$queryRaw`SELECT material_id FROM materials WHERE material_id = ${id}::uuid FOR UPDATE`;
  const material = await tx.material.findUnique({ where: { id } });
  if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
  return material;
}

export async function assertReadyMaterialFile(
  tx: TransactionContext,
  material: Parameters<typeof assertPublishableFile>[0] & {
    id: string;
    coverFileId?: string | null;
  },
  moderation?: FileContentModeration,
) {
  const objectKey = assertPublishableFile(material);
  const file = await tx.storedFile.findUnique({
    where: {
      objectKey,
      purpose: "MATERIAL",
      resourceType: "MATERIAL",
      resourceId: material.id,
      state: "READY",
      scanVerdict: "CLEAN",
    },
    select: {
      id: true,
      state: true,
      purpose: true,
      generation: true,
      sha256: true,
      moderationAssessment: true,
    },
  });
  if (!file) throw new ConflictException("MATERIAL_FILE_REQUIRED");
  if (!moderation?.isEnforcing()) return;
  moderation.assertShareable(file);
  if (!material.coverFileId) return;
  const cover = await tx.storedFile.findUnique({
    where: {
      id: material.coverFileId,
      purpose: "MATERIAL_COVER",
      resourceType: "MATERIAL_COVER",
      resourceId: material.id,
      scanVerdict: "CLEAN",
    },
  });
  if (!cover) throw new ConflictException("MATERIAL_COVER_NOT_READY");
  moderation.assertShareable(cover);
}
