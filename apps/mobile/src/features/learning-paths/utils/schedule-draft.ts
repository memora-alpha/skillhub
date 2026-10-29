import type { ApiLearningPlan } from "../api/learning-paths-contract";
import { ZodError } from "zod";
import {
  scheduleInputSchema,
  type ScheduleInput,
} from "../schemas/schedule-input";
import {
  previewScheduleItems,
  scheduleSlotDraft,
  scheduleConflicts,
  scheduleConflictMessage,
} from "./schedule-conflicts";

export function scheduleDraft(plan: ApiLearningPlan): ScheduleInput {
  return {
    items: Array.from({ length: plan.totalSessions }, (_, index) => {
      const slot = plan.schedule?.items.find(
        (item) => item.sessionNo === index + 1,
      );
      return slot ? scheduleSlotDraft(slot) : { local: "", minutes: "60" };
    }),
  };
}

export function scheduleDraftItems(
  input: ScheduleInput,
  plan: ApiLearningPlan,
) {
  const values = scheduleInputSchema.parse(input);
  const items = previewScheduleItems(values.items, plan.schedule?.items);
  // Restoring retained seconds can introduce an overlap hidden by minute fields.
  const conflicts = scheduleConflicts(items);
  if (conflicts.length)
    throw new ZodError(
      conflicts.map((conflict) => ({
        code: "custom",
        path: ["items", conflict.other.sessionNo - 1, "local"],
        message: scheduleConflictMessage(conflict),
      })),
    );
  return items;
}
