import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

/** Public display-name projection for participant-facing business messages. */
export async function readUserDisplayNames(
  tx: TransactionContext,
  userIds: string[],
) {
  const users = await tx.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((user) => [user.id, user.fullName]));
}
