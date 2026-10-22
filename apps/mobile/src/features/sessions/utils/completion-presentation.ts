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
  const unconfirmedLabel = pending
    ? "Đang xử lý…"
    : "Tôi xác nhận đã học buổi này";
  const label = confirmed ? "Đã xác nhận" : unconfirmedLabel;
  return { confirmed, label };
}
