import assert from "node:assert/strict";
import test from "node:test";
import type { PreferredAvailability } from "../src/features/learning-requests/schemas/request-preferences";
import { groupRequestSchedule } from "../src/features/learning-requests/utils/request-schedule-groups";

test("detail groups every weekly time range by day without changing saved slots", () => {
  const slots: PreferredAvailability["weeklySlots"] = [
    { weekday: "SAT", startTime: "19:00", endTime: "21:00" },
    { weekday: "THU", startTime: "19:00", endTime: "21:00" },
    { weekday: "SAT", startTime: "08:00", endTime: "10:00" },
    { weekday: "SUN", startTime: "08:00", endTime: "11:00" },
  ];
  const saved = structuredClone(slots);
  const groups = groupRequestSchedule(slots);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Thứ 5", "Thứ 7", "Chủ nhật"],
  );
  assert.deepEqual(
    groups.flatMap((group) => group.slots),
    [slots[1], slots[2], slots[0], slots[3]],
  );
  assert.deepEqual(slots, saved);
  assert.deepEqual(groupRequestSchedule([]), []);
});
