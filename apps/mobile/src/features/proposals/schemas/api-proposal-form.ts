import { z } from "zod";
import { creditHint } from "../api/proposal-input";
import type { Proposal, ProposalHints } from "../api/proposals-api";
const optionalInteger = (min: number, max: number, message: string) =>
  z
    .string()
    .optional()
    .refine(
      (value) =>
        !value?.trim() ||
        (/^\d+$/.test(value.trim()) &&
          Number(value) >= min &&
          Number(value) <= max),
      message,
    );
export const apiProposalForm = z
  .object({
    message: z
      .string()
      .transform((value) => value.normalize("NFC").trim())
      .refine((value) => [...value].length >= 10, "Nhập ít nhất 10 ký tự.")
      .refine((value) => [...value].length <= 1000, "Tối đa 1.000 ký tự.")
      .refine(
        (value) =>
          ![...value].some(
            (char) =>
              char.codePointAt(0)! < 32 && !["\t", "\n", "\r"].includes(char),
          ),
        "Nội dung không được chứa ký tự điều khiển.",
      ),
    type: z.enum(["", "ONE_WAY", "TWO_WAY"]).optional(),
    credit: z
      .string()
      .optional()
      .refine(
        (value) => !value?.trim() || creditHint.safeParse(value.trim()).success,
        "Nhập Credit lớn hơn 0, tối đa 2 chữ số thập phân, không thêm số 0 ở đầu.",
      ),
    duration: optionalInteger(60, 180, "Thời lượng từ 60 đến 180 phút."),
    sessions: optionalInteger(
      1,
      32767,
      "Nhập số buổi hợp lệ; giới hạn cụ thể theo quy định hiện tại.",
    ),
    // dev contract: free text, never interpreted as a confirmed schedule.
    candidateSlots: z
      .string()
      .transform((value) => value.normalize("NFC").trim())
      .optional(),
  })
  .superRefine((values, ctx) => {
    if (values.credit?.trim()) {
      if (!values.type)
        ctx.addIssue({
          code: "custom",
          path: ["type"],
          message: "Chọn hình thức trước khi gợi ý Credit.",
        });
      if (values.type === "TWO_WAY" && Number(values.credit) < 20)
        ctx.addIssue({
          code: "custom",
          path: ["credit"],
          message: "Trao đổi cần tối thiểu 20 Credit mỗi người.",
        });
    }
  });
export type ApiProposalValues = z.infer<typeof apiProposalForm>;
export function proposalFormValues(proposal?: Proposal): ApiProposalValues {
  return {
    message: proposal?.message ?? "",
    type: proposal?.exchangeTypeHint ?? "",
    credit: proposal?.proposedCredit ?? "",
    duration: String(proposal?.proposedDurationMinutes ?? ""),
    sessions: String(proposal?.initialSessionCount ?? ""),
    candidateSlots: proposal?.candidateSlots ?? "",
  };
}
export function proposalHints(
  values: ApiProposalValues,
  original?: Proposal,
): ProposalHints {
  const hints: ProposalHints = { message: values.message };
  const baseline = proposalFormValues(original);
  const fields = [
    ["type", "exchangeTypeHint"],
    ["credit", "proposedCredit"],
    ["duration", "proposedDurationMinutes"],
    ["sessions", "initialSessionCount"],
  ] as const;
  for (const [field, target] of fields) {
    const value = values[field]?.trim() ?? "";
    if (value === (baseline[field] ?? "")) continue;
    if (target === "exchangeTypeHint")
      hints[target] = value ? (values.type as "ONE_WAY" | "TWO_WAY") : null;
    else if (target === "proposedCredit") hints[target] = value || null;
    else hints[target] = value ? Number(value) : null;
  }
  const suggestion = values.candidateSlots?.normalize("NFC").trim() ?? "";
  const saved = baseline.candidateSlots?.normalize("NFC").trim() ?? "";
  if (suggestion !== saved) hints.candidateSlots = suggestion || null;
  return hints;
}
