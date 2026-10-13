import { deviceTimeZone } from "../schemas/request-preferences";

export function requestTimeZoneNote(
  timeZone: string,
  device = deviceTimeZone(),
) {
  try {
    const formatter = new Intl.DateTimeFormat("vi", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const sameZone =
      formatter.resolvedOptions().timeZone ===
      new Intl.DateTimeFormat("vi", { timeZone: device }).resolvedOptions()
        .timeZone;
    if (sameZone) {
      const offset = formatter
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value;
      const suffix = offset ? " · " + offset : "";
      return `Giờ theo thiết bị${suffix}`;
    }
    // Keep the saved IANA zone visible. A current GMT offset alone is ambiguous
    // for recurring schedules in regions with daylight saving time.
    return `Giờ theo lịch đã lưu · ${timeZone.replaceAll("_", " ")}`;
  } catch {
    return "Không xác định được múi giờ. Kiểm tra cài đặt ngày và giờ trên thiết bị.";
  }
}
