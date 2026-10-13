import type { PreferredAvailability } from "../schemas/request-preferences";
import { weekdays, weekdayLabels } from "./request-weekly-slots";

export function groupRequestSchedule(
  slots: PreferredAvailability["weeklySlots"],
) {
  return weekdays
    .map((weekday, index) => ({
      weekday,
      label: weekdayLabels[index],
      slots: slots
        .filter((slot) => slot.weekday === weekday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
    .filter((group) => group.slots.length);
}
