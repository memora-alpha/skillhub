import type { ApiMaterial } from "../api/material-contracts";

export const materialStatuses = {
  DRAFT: { label: "Bản nháp", tone: "muted" },
  PENDING_REVIEW: { label: "Chờ duyệt", tone: "warning" },
  PUBLISHED: { label: "Đã đăng", tone: "success" },
  REJECTED: { label: "Bị từ chối", tone: "error" },
  HIDDEN: { label: "Bị ẩn", tone: "error" },
  ARCHIVED: { label: "Đã ngừng chia sẻ", tone: "muted" },
} as const;
export type MaterialStatus = ApiMaterial["status"];
export type MaterialFilter = MaterialStatus | "ALL";
export const materialFilters = [
  "ALL",
  "PUBLISHED",
  "PENDING_REVIEW",
  "DRAFT",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
] as const;
export const canEditMaterial = (row: ApiMaterial) =>
  row.canEdit === true &&
  row.hasBeenPublished === false &&
  row.editBlockedReason === null &&
  (row.status === "DRAFT" || row.status === "REJECTED");
export function materialEditHint(row: ApiMaterial) {
  if (canEditMaterial(row)) return null;
  if (
    row.hasBeenPublished ||
    row.editBlockedReason === "MATERIAL_CONTENT_LOCKED" ||
    row.status === "PUBLISHED"
  )
    return "Tài liệu đã từng được đăng nên nội dung và giá được giữ nguyên. Muốn thay đổi, hãy đăng tài liệu mới.";
  if (row.status === "PENDING_REVIEW")
    return "Rút yêu cầu duyệt về bản nháp trước khi chỉnh sửa.";
  return "Tài liệu hiện không thể chỉnh sửa. Tải lại để kiểm tra quyền hiện tại.";
}
export const canArchiveMaterial = (row: ApiMaterial) =>
  row.status === "PUBLISHED";
export const canDeleteMaterial = (row: ApiMaterial) =>
  row.status === "DRAFT" || row.status === "ARCHIVED";
export const canWithdrawMaterial = (row: ApiMaterial) =>
  row.status === "PENDING_REVIEW";
export function materialArchivePresentation(row: ApiMaterial) {
  if (row.status === "PUBLISHED")
    return {
      icon: "eye-off" as const,
      label: "Ngừng chia sẻ",
      title: "Ngừng chia sẻ tài liệu?",
      description:
        "Tài liệu sẽ ngừng xuất hiện công khai và không nhận lượt mua hoặc truy cập mới. Người đã mua vẫn giữ quyền tải. Bạn có thể gửi duyệt lại nguyên nội dung trong mục Đã ngừng chia sẻ.",
      notice: "Đã ngừng chia sẻ tài liệu.",
    };
}
export const canSubmitMaterial = (row: ApiMaterial) =>
  (row.status === "DRAFT" || row.status === "ARCHIVED") &&
  !!row.file &&
  row.scanStatus === "CLEAN" &&
  !!row.distributionRightsConfirmedAt;
export function materialSubmitHint(row: ApiMaterial) {
  if (!["DRAFT", "ARCHIVED"].includes(row.status) || canSubmitMaterial(row))
    return null;
  if (!row.file) return "Thêm tệp trước khi gửi duyệt.";
  if (row.scanStatus !== "CLEAN") return "Tệp cần hoàn tất kiểm tra an toàn.";
  return "Xác nhận quyền phân phối trước khi gửi duyệt.";
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
export function filterOwnerMaterials(
  items: ApiMaterial[],
  filter: MaterialFilter,
  search: string,
) {
  const term = normalize(search.trim());
  return items.filter(
    (row) =>
      (filter === "ALL" || row.status === filter) &&
      (!term ||
        normalize(`${row.title} ${row.file?.originalFilename ?? ""}`).includes(
          term,
        )),
  );
}
export function materialFileType(row: ApiMaterial) {
  const mime = row.file?.mimeType;
  if (!mime) return "Chưa có tệp";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Ảnh";
  if (mime.includes("word")) return "Word";
  if (mime.includes("sheet") || mime.includes("excel")) return "Excel";
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return "PowerPoint";
  if (mime === "text/plain") return "Văn bản";
  return "Tệp đính kèm";
}
export function materialFileSize(value: string | null | undefined) {
  if (value == null) return null;
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 0) return null;
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000)
    return `${(bytes / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}
export const materialPrice = (row: ApiMaterial) =>
  row.accessType === "FREE"
    ? "Miễn phí"
    : `${Number(row.priceCredit).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} CR`;
export const materialDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
