import { z } from "zod";

// Mirrors parseCredit in the verified API contract; do not accept leading zeroes.
export const agreementInputSchema = z
  .object({
    type: z.enum(["TWO_WAY", "ONE_WAY"]),
    role: z.enum(["teacher", "learner"]),
    credit: z
      .string()
      .trim()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        "Credit không có số 0 đầu, tối đa 10 chữ số phần nguyên và 2 chữ số thập phân.",
      )
      .refine((value) => Number(value) > 0, "Credit phải lớn hơn 0."),
  })
  .refine((value) => value.type !== "TWO_WAY" || Number(value.credit) >= 20, {
    path: ["credit"],
    message: "Cam kết hai chiều tối thiểu 20 Credit mỗi người.",
  });
export type AgreementInput = z.infer<typeof agreementInputSchema>;
