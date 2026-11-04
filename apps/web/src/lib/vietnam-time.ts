// Reuse formatters across rows and renders, with the same timezone in SSR/browser.
const timezone = "Asia/Ho_Chi_Minh";
const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone });
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: timezone,
  dateStyle: "medium",
  timeStyle: "short",
});
const time = new Intl.DateTimeFormat("vi-VN", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
});
const dayMonth = new Intl.DateTimeFormat("vi-VN", {
  timeZone: timezone,
  day: "2-digit",
  month: "2-digit",
});

export const vietnamDateKey = (value: string | number) =>
  dateKey.format(new Date(value));
export const formatVietnamDateTime = (value: string) =>
  dateTime.format(new Date(value));
export const formatVietnamTime = (value: string) =>
  time.format(new Date(value));
export const formatVietnamDayMonth = (value: string) =>
  dayMonth.format(new Date(value));
