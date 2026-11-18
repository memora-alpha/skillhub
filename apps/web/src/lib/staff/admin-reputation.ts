export type ReputationEvent = {
  id: string;
  delta: number;
  scoreBefore: number;
  scoreAfter: number;
  reasonCode: string;
  sourceType: string;
  createdAt: string;
  canReverse: boolean;
  reversalReason: "ALREADY_REVERSED" | "SOURCE_NOT_REVERSIBLE" | null;
  reversedAt: string | null;
};
export type AdminReputationHistory = {
  user: { id: string; fullName: string; reputationScore: number };
  items: ReputationEvent[];
  nextCursor: string | null;
};

function invalid(): never {
  throw new Error("Chưa đọc được lịch sử uy tín. Vui lòng tải lại.");
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") return invalid();
  return value;
}
function id(value: unknown) {
  const result = text(value);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(result))
    return invalid();
  return result;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    return invalid();
  return value;
}
function timestamp(value: unknown) {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) return invalid();
  return result;
}

export function readAdminReputationHistory(
  value: unknown,
  userId: string,
): AdminReputationHistory {
  const data = record(value),
    user = record(data.user);
  if (user.id !== userId || !Array.isArray(data.items)) return invalid();
  const ids = new Set<string>();
  const items = data.items.map((input): ReputationEvent => {
    const row = record(input),
      eventId = id(row.id);
    if (ids.has(eventId)) return invalid();
    ids.add(eventId);
    const reversalReason = row.reversalReason;
    if (
      typeof row.canReverse !== "boolean" ||
      (reversalReason !== null &&
        reversalReason !== "ALREADY_REVERSED" &&
        reversalReason !== "SOURCE_NOT_REVERSIBLE")
    )
      return invalid();
    const reversedAt =
      row.reversedAt === null ? null : timestamp(row.reversedAt);
    if (row.canReverse !== (reversalReason === null && reversedAt === null))
      return invalid();
    return {
      id: eventId,
      delta: integer(row.delta),
      scoreBefore: integer(row.scoreBefore),
      scoreAfter: integer(row.scoreAfter),
      reasonCode: text(row.reasonCode),
      sourceType: text(row.sourceType),
      createdAt: timestamp(row.createdAt),
      canReverse: row.canReverse,
      reversalReason,
      reversedAt,
    };
  });
  const nextCursor = data.nextCursor === null ? null : text(data.nextCursor);
  if (nextCursor !== null && (!nextCursor || nextCursor.length > 2048))
    return invalid();
  return {
    user: {
      id: id(user.id),
      fullName: text(user.fullName),
      reputationScore: integer(user.reputationScore),
    },
    items,
    nextCursor,
  };
}

export function reputationReversalCommand(
  userId: string,
  history: AdminReputationHistory,
  eventId: string,
  reason: string,
) {
  const entry = history.items.find((item) => item.id === eventId);
  if (
    history.user.id !== userId ||
    !entry?.canReverse ||
    entry.reversedAt ||
    entry.reversalReason
  )
    throw new Error(
      "Lần thay đổi điểm này không còn được phép hoàn tác. Hãy tải lại lịch sử.",
    );
  const note = reason.trim();
  if (!note || note.length > 1000)
    throw new Error("Vui lòng nhập lý do hoàn tác, tối đa 1.000 ký tự.");
  return {
    path: `reputation/events/${entry.id}/reverse`,
    body: { reason: note },
  };
}
