import type { LearningSession } from "../types";
type SessionTimeState = Pick<LearningSession, "status" | "startAt" | "endAt">;

export function sessionPresentation(
  session: SessionTimeState,
  now = Date.now(),
) {
  const end = Date.parse(session.endAt);
  if (session.status === "NO_SHOW")
    return {
      label: "Có người vắng học",
      variant: "warning" as const,
      description:
        "Xem kết quả điểm danh, giải trình vắng học và xử lý học bù.",
    };
  if (session.status === "MAKEUP_REQUIRED")
    return {
      label: "Cần học bù",
      variant: "warning" as const,
      description: "Hai bên cần thống nhất và xác nhận lịch học bù trước hạn.",
    };
  if (session.status === "COMPLETED")
    return {
      label: "Đã hoàn thành",
      variant: "success" as const,
      description: "Hệ thống đã ghi nhận buổi học hoàn thành.",
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
  if (
    session.status === "AWAITING_CONFIRMATION" ||
    (session.status === "ONGOING" && now >= end)
  )
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
  if (now >= end)
    return {
      label: "Đã hết giờ học",
      variant: "warning" as const,
      description:
        "Đã hết giờ vào phòng. Tải lại để kiểm tra trạng thái buổi học.",
    };
  if (now >= Date.parse(session.startAt))
    return {
      label: "Chờ bắt đầu",
      variant: "warning" as const,
      description:
        "Đã đến giờ học. Vào phòng để bắt đầu; bạn có thể vào lại nếu mất kết nối trong giờ học.",
    };
  return {
    label: session.status === "READY" ? "Sắp bắt đầu" : "Sắp tới",
    variant: "sage" as const,
    description:
      "Lịch học đã được chốt. Đổi lịch cần cả hai xác nhận trước giờ bắt đầu ít nhất 60 phút.",
  };
}
