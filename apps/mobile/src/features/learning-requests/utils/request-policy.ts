import { AppError, errorMessage } from "@/lib/http/errors";
import type {
  OwnerRequest,
  RequestItem,
  RequestInput,
  RequestPatch,
} from "../types";
export const statusLabels = {
  DRAFT: "Bản nháp",
  PENDING_MODERATION: "Chờ kiểm duyệt",
  OPEN: "Đang mở",
  REJECTED: "Bị từ chối",
  NEGOTIATING: "Đang thương lượng",
  MATCHED: "Đã kết nối",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
} as const;
export function isOwnRequest(item: RequestItem): item is OwnerRequest {
  return "skillId" in item;
}
export function requestState(request: RequestItem) {
  return isOwnRequest(request)
    ? (request.effectiveStatus ?? request.status)
    : request.status;
}
export function editableRequest(request: OwnerRequest) {
  return ["DRAFT", "OPEN", "PENDING_MODERATION", "REJECTED"].includes(
    requestState(request),
  );
}
export function cancelableRequest(request: OwnerRequest) {
  return [
    "DRAFT",
    "OPEN",
    "PENDING_MODERATION",
    "REJECTED",
    "NEGOTIATING",
  ].includes(requestState(request));
}
export function dateLabel(date: string | null) {
  return date
    ? new Date(date).toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Chưa xác định";
}
export function requestError(error: unknown, mutation = false) {
  if (error instanceof AppError) {
    if (error.status === 503)
      return "Yêu cầu học hiện chưa khả dụng. Vui lòng thử lại sau.";
    if (error.status === 404)
      return "Yêu cầu không còn khả dụng hoặc bạn không có quyền xem.";
    if (error.status === 409)
      return "Yêu cầu đã thay đổi hoặc không còn cho phép thao tác này. Tải lại để xem bản mới nhất.";
    if (
      mutation &&
      (error.kind === "network" ||
        error.status >= 500 ||
        error.kind === "protocol")
    )
      return "Chưa xác nhận được kết quả lưu. Hãy kiểm tra lại yêu cầu trước khi thử lưu lần nữa.";
  }
  return errorMessage(error);
}
export function requestPatch(
  request: OwnerRequest,
  input: RequestInput,
): RequestPatch | null {
  const patch: RequestPatch = { expectedVersion: request.version };
  for (const field of [
    "title",
    "skillId",
    "description",
    "learningGoal",
    "currentLevel",
    "verifiedTeacherOnly",
  ] as const) {
    if (request[field] !== input[field])
      Object.assign(patch, { [field]: input[field] });
  }
  if (
    JSON.stringify(request.preferredSlots) !==
    JSON.stringify(input.preferredSlots)
  )
    patch.preferredSlots = input.preferredSlots;
  if (request.requestedExpiresAt !== input.expiresAt)
    patch.expiresAt = input.expiresAt;
  return Object.keys(patch).length > 1 ? patch : null;
}
