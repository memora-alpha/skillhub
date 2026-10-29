import { z } from "zod";
import { parseLocalDateTime } from "@/utils/local-date-time";
import {
  previewScheduleItems,
  scheduleConflicts,
  scheduleConflictMessage,
} from "../utils/schedule-conflicts";

export const scheduleInputSchema = z
  .object({
    items: z
      .array(
        z.object({
          local: z
            .string()
            .refine(
              (v) => !!parseLocalDateTime(v),
              "Chọn ngày và giờ bắt đầu buổi học.",
            ),
          minutes: z
            .string()
            .regex(/^\d+$/, "Nhập số phút.")
            .refine(
              (v) => Number(v) >= 60 && Number(v) <= 180,
              "Thời lượng từ 60 đến 180 phút.",
            ),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((data, context) => {
    let previousStart = 0;
    data.items.forEach((item, i) => {
      const date = parseLocalDateTime(item.local);
      if (!date) return;
      const start = date.getTime();
      if (start <= Date.now())
        context.addIssue({
          code: "custom",
          path: ["items", i, "local"],
          message: "Buổi học phải ở tương lai.",
        });
      if (start < previousStart)
        context.addIssue({
          code: "custom",
          path: ["items", i, "local"],
          message: `Buổi ${i + 1} phải bắt đầu sau buổi ${i}. Hãy sửa ngày hoặc giờ bắt đầu.`,
        });
      previousStart = start;
    });
    for (const conflict of scheduleConflicts(
      previewScheduleItems(data.items),
    )) {
      context.addIssue({
        code: "custom",
        path: ["items", conflict.other.sessionNo - 1, "local"],
        message: scheduleConflictMessage(conflict),
      });
    }
  });
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export function scheduleItems(input: ScheduleInput) {
  return previewScheduleItems(scheduleInputSchema.parse(input).items);
}
