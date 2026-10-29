import { NotFoundException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockUsers } from "../../../../shared/database/identity-transactions";

/** All Path writers lock participants first, including implicit User FK locks. */
export async function lockLearningPath(
  tx: TransactionContext,
  pathId: string,
): Promise<void> {
  const path = await tx.learningPath.findUnique({
    where: { id: pathId },
    select: { participantAId: true, participantBId: true },
  });
  if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
  await lockUsers(tx, [path.participantAId, path.participantBId]);
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT path_id AS id FROM learning_paths WHERE path_id = ${pathId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
}
