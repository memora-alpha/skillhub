import { z } from "zod";
import type { CreateLearningPlanInput } from "../api/learning-paths-contract";

export const planEditorSchema = z.object({
  skillId: z.uuid("Chọn kỹ năng trong danh mục."),
  learningGoal: z
    .string()
    .trim()
    .min(1, "Nhập mục tiêu học.")
    .max(1500, "Mục tiêu tối đa 1.500 ký tự."),
  sessionOutline: z
    .array(
      z.object({
        content: z
          .string()
          .refine(
            (value) => !!value.split(/\r?\n/, 1)[0]?.trim(),
            "Nhập tiêu đề buổi học.",
          )
          .trim()
          .min(1, "Nhập nội dung buổi học.")
          .max(2000, "Mỗi buổi tối đa 2.000 ký tự."),
      }),
    )
    .min(1, "Thêm ít nhất một buổi học.")
    .max(100, "Lộ trình tối đa 100 buổi."),
});
export type PlanEditorValues = z.infer<typeof planEditorSchema>;
export function planEditorInput(
  values: PlanEditorValues,
): CreateLearningPlanInput {
  const valid = planEditorSchema.parse(values);
  return { ...valid, totalSessions: valid.sessionOutline.length };
}
