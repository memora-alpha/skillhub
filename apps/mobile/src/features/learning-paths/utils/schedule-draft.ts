import type { ApiLearningPlan } from "../api/learning-paths-contract";
import { scheduleItems, type ScheduleInput } from "../schemas/schedule-input";

function slotDraft(slot: { startAt: string; endAt: string }) {
  const start = new Date(slot.startAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    local: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
    minutes: String((Date.parse(slot.endAt) - start.getTime()) / 60000),
  };
}

export function scheduleDraft(plan: ApiLearningPlan): ScheduleInput {
  return {
    items: Array.from({ length: plan.totalSessions }, (_, index) => {
      const slot = plan.schedule?.items.find(
        (item) => item.sessionNo === index + 1,
      );
      return slot ? slotDraft(slot) : { local: "", minutes: "60" };
    }),
  };
}

export function scheduleDraftItems(
  input: ScheduleInput,
  plan: ApiLearningPlan,
) {
  return scheduleItems(input).map((item, index) => {
    const previous = plan.schedule?.items.find(
      (slot) => slot.sessionNo === item.sessionNo,
    );
    if (!previous) return item;
    const original = slotDraft(previous);
    if (input.items[index]?.local !== original.local) return item;
    // A minute-based picker must not silently discard seconds from an existing slot.
    return {
      sessionNo: item.sessionNo,
      startAt: previous.startAt,
      endAt:
        input.items[index]?.minutes === original.minutes
          ? previous.endAt
          : new Date(
              Date.parse(previous.startAt) +
                Number(input.items[index]!.minutes) * 60000,
            ).toISOString(),
    };
  });
}
