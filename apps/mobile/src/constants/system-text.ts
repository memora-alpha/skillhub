import { systemLabels } from "../../../../packages/content/system-labels";
/** Presentation only: API codes and submitted values must remain unchanged. */
const labels: Readonly<Record<string, string>> = {
  ...systemLabels,
};

export function systemCodeLabel(
  code: string,
  fallback = "Thông tin đang được cập nhật",
) {
  return Object.hasOwn(labels, code) ? labels[code]! : fallback;
}

/** Translate system-generated descriptions; preserve participants' own wording. */
export function reportDescriptionText(description: string) {
  if (Object.hasOwn(labels, description)) return labels[description]!;
  if (
    description ===
    "Attendance could not be verified and neither participant confirmed completion."
  )
    return "Không thể xác minh việc tham gia buổi học và chưa bên nào xác nhận hoàn thành.";
  if (description === "No makeup time was agreed before the makeup deadline.")
    return "Hai bên chưa thống nhất lịch học bù trước khi hết hạn.";
  return description;
}

export function knownSystemMessage(code: string) {
  return Object.hasOwn(labels, code) ? labels[code] : undefined;
}
