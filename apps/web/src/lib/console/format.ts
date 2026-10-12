// Pinned timezone so server and client render identical strings (no hydration drift).
const TZ = "Asia/Ho_Chi_Minh";
const date = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const time = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
const num = new Intl.NumberFormat("vi-VN");

export const fmtDate = (iso: string) => date.format(new Date(iso));
export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
export const fmtTime = (iso: string) => time.format(new Date(iso));
export const fmtNum = (n: number) => num.format(n);
export const fmtCredit = (n: number) => `${n > 0 ? "+" : ""}${num.format(n)}`;
export const fmtVnd = (n: number) => `${num.format(n)} ₫`;
export const fmtSize = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
