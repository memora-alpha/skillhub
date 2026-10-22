import type { LearningSession } from "../types";
type SessionInput = Omit<LearningSession, "status" | "role"> & {
  status: string;
};
export const confirmationKnown = (value: string | null) =>
  value === null || value === "CONFIRMED";
export function confirmationLabel(value: string | null) {
  if (value === "CONFIRMED") return "Đã xác nhận hoàn thành";
  return value === null ? "Chưa xác nhận hoàn thành" : "Chưa xác định";
}
export const isParticipant = (s: SessionInput, userId: string) =>
  s.teacherId === userId || s.learnerId === userId;
export function ownConfirmation(s: SessionInput, userId: string) {
  return s.teacherId === userId
    ? s.teacherConfirmationStatus
    : s.learnerConfirmationStatus;
}
export function canConfirmSession(
  s: SessionInput,
  userId: string,
  now = Date.now(),
) {
  return (
    isParticipant(s, userId) &&
    ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"].includes(
      s.status,
    ) &&
    Date.parse(s.endAt) <= now &&
    ownConfirmation(s, userId) !== "CONFIRMED" &&
    confirmationKnown(s.teacherConfirmationStatus) &&
    confirmationKnown(s.learnerConfirmationStatus)
  );
}
