import { z } from "zod";

// Credit and session count remain suggestions until agreement negotiation.
export const proposalFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, "Nhập lời giới thiệu từ 10 đến 1.000 ký tự.")
    .max(1000, "Nhập lời giới thiệu từ 10 đến 1.000 ký tự."),
  credit: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0,
      "Nhập Credit lớn hơn 0, tối đa 10 chữ số nguyên và 2 chữ số thập phân.",
    ),
  sessions: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) >= 1,
      "Nhập số buổi nguyên lớn hơn hoặc bằng 1.",
    ),
  schedule: z.string().trim(),
});
export type ProposalFormValues = z.infer<typeof proposalFormSchema>;
export const rejectionFormSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Nhập lý do từ chối để người gửi hiểu lựa chọn của bạn.")
    .max(1000, "Lý do không vượt quá 1.000 ký tự."),
});
