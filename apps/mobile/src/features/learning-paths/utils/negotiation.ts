import { z } from "zod";
export const negotiationSchema = z
  .object({
    type: z.enum(["TWO_WAY", "ONE_WAY"]),
    role: z.enum(["teacher", "learner"]),
    credit: z
      .string()
      .trim()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        "Nhập Credit hợp lệ, tối đa 2 chữ số thập phân.",
      ),
    skill: z.string().trim().min(1, "Nhập kỹ năng muốn trao đổi.").max(100),
    goal: z
      .string()
      .trim()
      .min(10, "Mô tả mục tiêu ít nhất 10 ký tự.")
      .max(500),
    outline: z
      .string()
      .trim()
      .min(5, "Nhập nội dung từng buổi, mỗi buổi một dòng.")
      .max(1000),
  })
  .superRefine((draft, context) => {
    if (
      Number(draft.credit) <= 0 ||
      (draft.type === "TWO_WAY" && Number(draft.credit) < 20)
    )
      context.addIssue({
        code: "custom",
        path: ["credit"],
        message:
          draft.type === "TWO_WAY"
            ? "Mỗi người cam kết ít nhất 20 Credit."
            : "Credit phải lớn hơn 0.",
      });
    const lessons = draft.outline
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      !lessons.length ||
      lessons.length > 100 ||
      lessons.some((line) => line.length < 5)
    )
      context.addIssue({
        code: "custom",
        path: ["outline"],
        message:
          "Mỗi dòng là một buổi, mô tả ít nhất 5 ký tự; tối đa 100 buổi.",
      });
    if (formatNegotiation(draft).length > 2000)
      context.addIssue({
        code: "custom",
        path: ["outline"],
        message: "Rút gọn nội dung để gợi ý qua Chat không vượt 2.000 ký tự.",
      });
  });
export type NegotiationDraft = z.infer<typeof negotiationSchema>;
export function negotiationMessage(input: NegotiationDraft) {
  const draft = negotiationSchema.parse(input);
  return formatNegotiation(draft);
}
function formatNegotiation(draft: NegotiationDraft) {
  const outline = draft.outline
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return [
    "GỢI Ý LỘ TRÌNH · CHƯA XÁC NHẬN",
    `Hình thức: ${draft.type === "TWO_WAY" ? "Trao đổi hai chiều" : "Học một chiều"}`,
    `Chiều trao đổi: ${draft.type === "TWO_WAY" || draft.role === "teacher" ? "Tôi dạy → bạn học" : "Tôi mong muốn học từ bạn"}`,
    `Kỹ năng: ${draft.skill}`,
    `Mục tiêu: ${draft.goal}`,
    `Credit gợi ý cho toàn thỏa thuận: ${draft.credit}${draft.type === "TWO_WAY" ? " mỗi người" : ""}`,
    ...outline.map((lesson, i) => `Buổi ${i + 1}: ${lesson}`),
    "Đây là nội dung thương lượng trong Chat. Người dạy tự tạo kế hoạch; kế hoạch và lịch cần xác nhận riêng. Chưa giữ Credit.",
  ].join("\n");
}
