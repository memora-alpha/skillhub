import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
export type NotificationPreferences = {
  learning: boolean;
  credit: boolean;
  community: boolean;
};
export function notificationPreferences(
  value: unknown,
): NotificationPreferences {
  const input = value as Partial<NotificationPreferences> | null;
  return {
    learning: input?.learning ?? true,
    credit: input?.credit ?? true,
    community: input?.community ?? true,
  };
}
export function notificationGroup(
  type: string,
): keyof NotificationPreferences | null {
  if (
    /^(payment|credit|wallet)\./.test(type) ||
    type === "learning-path.settled" ||
    /^material\.(purchased|refunded)$/.test(type)
  )
    return "credit";
  if (
    type === "LEARNING_REQUEST_REJECTED" ||
    /^(learning-path|learning-request|session|proposal|conversation|chat|report)\./.test(
      type,
    )
  )
    return "learning";
  if (/^(skill|material|achievement|badge|reputation|community)\./.test(type))
    return "community";
  return null; // Authentication/security and unknown events keep existing delivery behavior.
}
/** All delivery paths evaluate the same per-recipient policy inside their owner transaction. */
export async function preferredRecipients(
  tx: TransactionContext,
  userIds: string[],
  type: string,
) {
  const group = notificationGroup(type);
  if (!group || !userIds.length) return userIds;
  const users = await tx.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, notificationPreferences: true },
  });
  const disabled = new Set(
    users
      .filter(
        (user) => !notificationPreferences(user.notificationPreferences)[group],
      )
      .map((user) => user.id),
  );
  return userIds.filter((id) => !disabled.has(id));
}
