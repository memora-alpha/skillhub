import { AppError, errorMessage } from "@/lib/http/errors";
import type { SessionRecording } from "../api/classroom-contracts";

const messages: Record<string, string> = {
  WHITEBOARD_POLICY_NOT_READY: "Bảng trắng chưa sẵn sàng trên máy chủ.",
  WHITEBOARD_READ_ONLY:
    "Bảng trắng đã chuyển sang chỉ xem. Nét vẽ chưa lưu vẫn được giữ trên màn hình.",
  WHITEBOARD_REVISION_CONFLICT:
    "Bảng vừa được người cùng học cập nhật. Đang hợp nhất nội dung; hãy lưu lại.",
  WHITEBOARD_SCENE_TOO_LARGE:
    "Bảng đã vượt dung lượng lưu 2 MB. Hãy giảm nội dung mới.",
  INVALID_WHITEBOARD_SCENE: "Nội dung bảng trắng chưa đúng định dạng.",
  RECORDING_DISABLED: "Tính năng ghi hình chưa được máy chủ bật.",
  RECORDING_UNAVAILABLE: "Dịch vụ ghi hình đang gián đoạn. Hãy thử lại sau.",
  RECORDING_PLAN_REQUIRED: "Người bắt đầu ghi hình cần gói có quyền ghi hình.",
  RECORDING_MINUTES_EXHAUSTED: "Người bắt đầu ghi hình đã hết phút trong kỳ.",
  RECORDING_ALREADY_ACTIVE:
    "Buổi học đã có yêu cầu hoặc bản ghi đang hoạt động.",
  RECORDING_WINDOW_NOT_OPEN: "Chỉ ghi hình trong thời gian phòng học cho phép.",
  RECORDING_ROOM_NOT_STARTED: "Hãy vào phòng học trước khi yêu cầu ghi hình.",
  RECORDING_STATE_CONFLICT:
    "Yêu cầu ghi hình đã thay đổi. Kiểm tra trạng thái mới trước khi thao tác.",
  RECORDING_ACTION_NOT_ALLOWED:
    "Chỉ người nhận yêu cầu mới được đồng ý hoặc từ chối.",
  RECORDING_NOT_FOUND: "Không tìm thấy bản ghi này.",
  RECORDING_NOT_READY: "Bản ghi chưa sẵn sàng hoặc đã hết hạn xem.",
  RECORDING_HELD_BY_REPORT:
    "Bản ghi đang được giữ làm bằng chứng nên chưa thể xóa.",
};
export function classroomError(cause: unknown) {
  return cause instanceof AppError
    ? (messages[cause.code] ?? errorMessage(cause))
    : "Chưa hoàn tất thao tác. Kiểm tra kết nối và thử lại.";
}
export const recordingLabels: Record<SessionRecording["status"], string> = {
  REQUESTED: "Chờ đồng ý",
  DECLINED: "Đã từ chối",
  REQUEST_EXPIRED: "Yêu cầu hết hạn",
  STARTING: "Đang bắt đầu ghi",
  RECORDING: "Đang ghi hình",
  STOPPING: "Đang xử lý bản ghi",
  READY: "Có thể xem lại",
  FAILED: "Ghi hình thất bại",
  EXPIRED: "Hết hạn lưu",
  DELETED: "Đã xóa",
};
export function recordingActions(
  row: SessionRecording,
  userId: string,
  now = Date.now(),
) {
  const waiting =
    row.status === "REQUESTED" && Date.parse(row.requestedAt) + 120_000 > now;
  return {
    answer: waiting && row.requestedByUserId !== userId,
    waiting,
    stop: ["STARTING", "RECORDING"].includes(row.status),
    play:
      row.status === "READY" &&
      (!row.expiresAt || Date.parse(row.expiresAt) > now || row.heldByReport),
    delete: row.status === "READY" && !row.heldByReport,
  };
}
export function boardReadOnlyText(reason: string | null) {
  const reasons: Record<string, string> = {
    SESSION_UNDER_REPORT:
      "Bảng đang được giữ nguyên vì buổi học có báo cáo cần xử lý.",
    SESSION_NOT_EDITABLE: "Trạng thái buổi học hiện chỉ cho phép xem bảng.",
    EDIT_WINDOW_NOT_OPEN: "Chưa đến thời gian chỉnh sửa bảng trắng.",
    EDIT_WINDOW_CLOSED: "Đã hết thời gian chỉnh sửa. Bạn vẫn có thể xem lại.",
    WHITEBOARD_POLICY_NOT_READY: messages.WHITEBOARD_POLICY_NOT_READY!,
  };
  return reasons[reason ?? ""] ?? "Bảng trắng đang ở chế độ chỉ xem.";
}
