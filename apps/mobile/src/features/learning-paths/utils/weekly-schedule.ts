import { parseLocalDateTime } from "@/utils/local-date-time";
import {
  scheduleInputSchema,
  type ScheduleInput,
} from "../schemas/schedule-input";

export type WeeklyScheduleInput = {
  start: string;
  days: readonly number[];
  minutes: string;
};
export function generateWeeklySchedule(
  input: WeeklyScheduleInput,
  count: number,
): ScheduleInput["items"] {
  const start = parseLocalDateTime(input.start);
  if (!start) throw new Error("Chọn ngày và giờ bắt đầu.");
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("Lộ trình cần từ 1 đến 100 buổi.");
  if (
    !input.days.length ||
    input.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new Error("Chọn ít nhất một thứ trong tuần.");
  const items: ScheduleInput["items"] = [];
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const clock = input.start.slice(11);
  for (let offset = 0; items.length < count && offset < 700; offset++) {
    if (input.days.includes(cursor.getDay())) {
      const date = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, "0"),
        String(cursor.getDate()).padStart(2, "0"),
      ].join("-");
      items.push({ local: `${date}T${clock}`, minutes: input.minutes });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const checked = scheduleInputSchema.safeParse({ items });
  if (!checked.success)
    throw new Error(
      checked.error.issues[0]?.message ?? "Kiểm tra ngày giờ và thời lượng.",
    );
  return checked.data.items;
}

export function scheduleSlotLabel(item: ScheduleInput["items"][number]) {
  const start = parseLocalDateTime(item.local);
  if (!start || !/^\d+$/.test(item.minutes)) return "Chưa chọn ngày giờ";
  const end = new Date(start.getTime() + Number(item.minutes) * 60000);
  return `${start.toLocaleString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}
