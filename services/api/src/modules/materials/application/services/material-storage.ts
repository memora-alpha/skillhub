import { ConflictException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

/**
 * Spec 021 D9: bytes of an owner's material files. A removed material (`deletedAt` set) stops
 * counting at once (policies Q4 default); archived materials still count because their file is
 * kept. Covers and replaced files are not counted: a material stores only its current file size.
 */
export async function materialStorageUsed(
  tx: TransactionContext,
  ownerId: string,
  excludeMaterialId?: string,
): Promise<bigint> {
  const sum = await tx.material.aggregate({
    where: {
      ownerId,
      deletedAt: null,
      ...(excludeMaterialId ? { id: { not: excludeMaterialId } } : {}),
    },
    _sum: { sizeBytes: true },
  });
  return BigInt(sum._sum.sizeBytes ?? 0);
}

/** Serializes one owner's attaches so two near the limit cannot both pass. */
export async function lockMaterialStorage(
  tx: TransactionContext,
  ownerId: string,
): Promise<void> {
  const key = `material-storage:${ownerId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/**
 * Refuses an attach that would take the owner past `allowedBytes`. The material's own current
 * file is replaced, so it is left out of the total. Existing materials over the allowance are
 * never touched (D13); only the new attach is refused.
 */
export async function assertMaterialStorage(
  tx: TransactionContext,
  input: {
    ownerId: string;
    materialId: string;
    sizeBytes: bigint;
    allowedBytes: bigint;
  },
): Promise<void> {
  await lockMaterialStorage(tx, input.ownerId);
  const used = await materialStorageUsed(tx, input.ownerId, input.materialId);
  if (used + input.sizeBytes > input.allowedBytes)
    throw new ConflictException({
      message: "MATERIAL_STORAGE_QUOTA_EXCEEDED",
      usedBytes: used.toString(),
      allowedBytes: input.allowedBytes.toString(),
      fileBytes: input.sizeBytes.toString(),
    });
}
