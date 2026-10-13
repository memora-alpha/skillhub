const vietnamTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// Preserve the server instant. Never compensate for a server/Prisma clock error.
export function evidenceTime(value: string) {
  const timestamp = Date.parse(value);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(timestamp))
    return "Thời gian không khả dụng";
  return `${vietnamTime.format(timestamp)} (giờ Việt Nam)`;
}
