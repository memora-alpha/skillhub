import type { LearningSession } from "../types";
type SessionTimeState = Pick<LearningSession, "status" | "startAt" | "endAt">;

export const sessionFilters = [
  "Sắp tới",
  "Đang học",
  "Chờ xác nhận",
  "Đã hoàn thành",
  "Đã hủy / tranh chấp",
];

export function matchesSessionFilter(
  session: SessionTimeState,
  filter: string,
  now = Date.now(),
) {
  if (filter === "Đã hoàn thành") return session.status === "COMPLETED";
  if (filter === "Đã hủy / tranh chấp")
    return ["CANCELLED", "DISPUTED"].includes(session.status);
  if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(session.status))
    return false;
  if (filter === "Chờ xác nhận")
    return (
      session.status === "AWAITING_CONFIRMATION" ||
      Date.parse(session.endAt) <= now
    );
  if (filter === "Đang học")
    return (
      Date.parse(session.startAt) <= now && now < Date.parse(session.endAt)
    );
  return (
    session.status !== "AWAITING_CONFIRMATION" &&
    Date.parse(session.startAt) > now
  );
}

export function sessionPresentation(
  session: SessionTimeState,
  now = Date.now(),
) {
  const end = Date.parse(session.endAt);
  if (session.status === "COMPLETED")
    return {
      label: "Đã hoàn thành",
      variant: "success" as const,
      description: "Cả hai bên đã xác nhận hoàn thành buổi học.",
    };
  if (session.status === "CANCELLED")
    return {
      label: "Đã hủy",
      variant: "default" as const,
      description: "Buổi học đã hủy và không còn diễn ra theo lịch này.",
    };
  if (session.status === "DISPUTED")
    return {
      label: "Đang tranh chấp",
      variant: "warning" as const,
      description: "Chưa thể xác nhận hoàn thành khi buổi học đang tranh chấp.",
    };
  if (session.status === "AWAITING_CONFIRMATION" || now >= end)
    return {
      label: "Đã kết thúc · chờ xác nhận",
      variant: "warning" as const,
      description:
        "Buổi học đã kết thúc; cần xác nhận hoàn thành của cả hai bên.",
    };
  if (session.status === "ONGOING")
    return {
      label: "Đang học",
      variant: "sage" as const,
      description: "Buổi học đang diễn ra.",
    };
  if (now >= Date.parse(session.startAt))
    return {
      label: "Đang trong giờ học",
      variant: "sage" as const,
      description:
        "Đã đến giờ học. Xác nhận hoàn thành sau khi buổi học kết thúc.",
    };
  return {
    label: session.status === "READY" ? "Sắp bắt đầu" : "Sắp tới",
    variant: "sage" as const,
    description:
      "Lịch học đã được chốt. Xác nhận hoàn thành sau khi buổi học kết thúc.",
  };
}
