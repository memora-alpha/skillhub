import { parseLocalDateTime } from "@/utils/local-date-time";
import type { ApiLearningPlan } from "../api/learning-paths-contract";

export type ScheduleSlot = {
  sessionNo: number;
  startAt: string;
  endAt: string;
};
type TimeWindow = Pick<ScheduleSlot, "startAt" | "endAt">;
export type ScheduleConflict = {
  slot: ScheduleSlot;
  other: ScheduleSlot;
  source: "draft" | "counterpart";
};

export function scheduleSlotDraft(slot: TimeWindow) {
  const start = new Date(slot.startAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    local: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
    minutes: String((Date.parse(slot.endAt) - start.getTime()) / 60_000),
  };
}

// Use the same retained seconds for previews and the submitted payload.
export function previewScheduleItems(
  items: readonly { local: string; minutes: string }[],
  originals: readonly ScheduleSlot[] = [],
): ScheduleSlot[] {
  return items.flatMap((item, index) => {
    const start = parseLocalDateTime(item.local);
    const duration = Number(item.minutes);
    if (
      !start ||
      !/^\d+$/.test(item.minutes) ||
      duration < 60 ||
      duration > 180
    )
      return [];
    const previous = originals.find((slot) => slot.sessionNo === index + 1);
    const draft = previous ? scheduleSlotDraft(previous) : undefined;
    const retainStart = previous && draft?.local === item.local;
    const startAt = retainStart ? previous.startAt : start.toISOString();
    const endAt =
      retainStart && draft.minutes === item.minutes
        ? previous.endAt
        : new Date(Date.parse(startAt) + duration * 60_000).toISOString();
    return [{ sessionNo: index + 1, startAt, endAt }];
  });
}

export function scheduleOverlap(left: TimeWindow, right: TimeWindow) {
  const start = Math.max(Date.parse(left.startAt), Date.parse(right.startAt));
  const end = Math.min(Date.parse(left.endAt), Date.parse(right.endAt));
  return start < end
    ? {
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
      }
    : undefined;
}

export function scheduleBusyRange(slot: TimeWindow) {
  const dayStart = new Date(slot.startAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(Date.parse(slot.endAt) - 1);
  dayEnd.setHours(24, 0, 0, 0);
  const from = new Date(dayStart);
  // /sessions/mine filters startAt, so include sessions starting the previous day.
  from.setDate(from.getDate() - 1);
  return {
    from: from.toISOString(),
    to: new Date(dayEnd.getTime() - 1).toISOString(),
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
  };
}

export function scheduleWindowLabel(slot: TimeWindow) {
  const start = new Date(slot.startAt),
    end = new Date(slot.endAt);
  const date = (value: Date) => value.toLocaleDateString("vi-VN");
  const showSeconds = start.getSeconds() !== 0 || end.getSeconds() !== 0;
  const time = (value: Date) =>
    value.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      ...(showSeconds ? { second: "2-digit" as const } : {}),
      hour12: false,
    });
  const endDate = date(start) === date(end) ? "" : `${date(end)} `;
  return `${date(start)} ${time(start)}–${endDate}${time(end)}`;
}

export function scheduleConflicts(
  slots: readonly ScheduleSlot[],
  otherPlans: readonly ApiLearningPlan[] = [],
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  slots.forEach((slot, index) => {
    for (const other of slots.slice(index + 1)) {
      if (scheduleOverlap(slot, other))
        conflicts.push({ slot, other, source: "draft" });
    }
    for (const plan of otherPlans) {
      const schedule = plan.schedule;
      if (
        !schedule ||
        !["PROPOSED", "PARTIALLY_CONFIRMED", "LOCKED"].includes(schedule.status)
      )
        continue;
      for (const other of schedule.items) {
        if (scheduleOverlap(slot, other))
          conflicts.push({ slot, other, source: "counterpart" });
      }
    }
  });
  return conflicts;
}

export function scheduleConflictMessage(conflict: ScheduleConflict) {
  const { slot, other, source } = conflict;
  if (source === "draft")
    return `Buổi ${other.sessionNo} trùng với buổi ${slot.sessionNo}: ${scheduleWindowLabel(slot)}.`;
  return `Trùng với buổi ${other.sessionNo} trong lịch người còn lại dạy: ${scheduleWindowLabel(other)}.`;
}
