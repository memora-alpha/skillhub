import type { CompletionReceipt, LearningSession } from "../types";
import { isParticipant, ownConfirmation } from "./session-policy";

export function completionSubmitPresentation(
  session: LearningSession | undefined,
  userId: string,
  receipt: CompletionReceipt | undefined,
  pending: boolean,
) {
  const confirmed =
    !!session &&
    isParticipant(session, userId) &&
    (ownConfirmation(session, userId) === "CONFIRMED" ||
      session.status === "COMPLETED" ||
      receipt?.id === session.id);
  const label = confirmed
    ? "Đã xác nhận"
    : pending
      ? "Đang xử lý…"
      : "Tôi xác nhận đã học buổi này";
  return { confirmed, label };
}
