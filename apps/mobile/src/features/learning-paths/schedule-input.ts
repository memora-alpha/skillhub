import { z } from "zod";
import { parseLocalDateTime } from "@/utils/local-date-time";

export const scheduleInputSchema = z
  .object({
    items: z
      .array(
        z.object({
          local: z
            .string()
            .refine(
              (v) => !!parseLocalDateTime(v),
              "Nhập ngày giờ theo YYYY-MM-DDTHH:mm.",
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
    let previousEnd = 0;
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
      if (start < previousEnd)
        context.addIssue({
          code: "custom",
          path: ["items", i, "local"],
          message: "Các buổi phải theo thứ tự và không trùng nhau.",
        });
      previousEnd = start + Number(item.minutes) * 60000;
    });
  });
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export function scheduleItems(input: ScheduleInput) {
  const values = scheduleInputSchema.parse(input);
  return values.items.map((item, i) => {
    const start = parseLocalDateTime(item.local)!;
    return {
      sessionNo: i + 1,
      startAt: start.toISOString(),
      endAt: new Date(
        start.getTime() + Number(item.minutes) * 60000,
      ).toISOString(),
    };
  });
}
