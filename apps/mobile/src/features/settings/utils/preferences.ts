export const timezoneOptions = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "UTC",
  "Europe/London",
  "America/New_York",
] as const;

const timezoneLabels: Record<string, string> = {
  "Asia/Ho_Chi_Minh": "Việt Nam · Hồ Chí Minh",
  "Asia/Bangkok": "Thái Lan · Bangkok",
  "Asia/Singapore": "Singapore",
  "Asia/Tokyo": "Nhật Bản · Tokyo",
  UTC: "Giờ quốc tế · UTC",
  "Europe/London": "Anh · London",
  "America/New_York": "Hoa Kỳ · New York",
};

export const timezoneLabel = (zone: string) =>
  timezoneLabels[zone] ?? zone.replaceAll("_", " ");

export function validTimezone(value: string) {
  if (!value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("vi", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function timezoneSample(value: string) {
  if (!validTimezone(value)) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: value,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}
