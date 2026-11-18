import type { OwnedMaterial } from "./account-types";

export type MaterialAction = "submit" | "withdraw" | "archive" | "delete";
export function canEditMaterial(material: OwnedMaterial) {
  return (
    material.canEdit === true &&
    material.hasBeenPublished === false &&
    ["DRAFT", "REJECTED"].includes(material.status)
  );
}
export function canManageMaterial(
  material: OwnedMaterial,
  action: MaterialAction,
) {
  if (
    !Number.isSafeInteger(material.listingVersion) ||
    material.listingVersion < 1
  )
    return false;
  switch (action) {
    case "submit":
      return ["DRAFT", "ARCHIVED"].includes(material.status);
    case "withdraw":
      return material.status === "PENDING_REVIEW";
    case "archive":
      return material.status === "PUBLISHED";
    case "delete":
      return ["DRAFT", "ARCHIVED"].includes(material.status);
  }
}
export function materialEditHint(material: OwnedMaterial) {
  if (
    material.hasBeenPublished ||
    material.editBlockedReason === "MATERIAL_CONTENT_LOCKED"
  )
    return "Tài liệu đã từng xuất bản nên nội dung và giá được giữ nguyên. Muốn thay đổi, hãy chia sẻ tài liệu mới.";
  if (material.status === "PENDING_REVIEW")
    return "Rút khỏi hàng chờ duyệt nếu bạn cần chỉnh sửa.";
  return "Tài liệu hiện chưa thể chỉnh sửa.";
}
