export type Tag = { id: string; label: string };
export function normalizeTag(value: string) {
  const label = value.trim().normalize("NFC").replace(/\s+/gu, " ");
  if (/\p{Cc}/u.test(value) || !label || Array.from(label).length > 80)
    throw new Error(
      "Tên tag cần từ 1 đến 80 ký tự và không chứa ký tự điều khiển.",
    );
  return label;
}
export function validateTagSelection(
  ids: string[],
  labels: string[],
  known: Tag[] = [],
) {
  if (new Set(ids).size !== ids.length || ids.length + labels.length > 10)
    throw new Error("Chọn tối đa 10 tag, tính cả tag có sẵn và tag đề xuất.");
  const normalized = labels.map(normalizeTag);
  const keys = normalized.map((label) => label.toLowerCase());
  if (new Set(keys).size !== keys.length)
    throw new Error("Các tag đề xuất bị trùng sau khi chuẩn hóa tên.");
  if (
    known.some(
      (tag) =>
        ids.includes(tag.id) &&
        keys.includes(normalizeTag(tag.label).toLowerCase()),
    )
  )
    throw new Error("Tag đề xuất đã nằm trong các tag có sẵn được chọn.");
  return normalized;
}
