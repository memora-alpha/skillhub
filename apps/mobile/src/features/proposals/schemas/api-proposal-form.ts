import { z } from "zod";
import type { ProposalHints } from "../api/proposals-api";
export const apiProposalForm = z.object({
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
});
export type ApiProposalValues = z.infer<typeof apiProposalForm>;
export function proposalHints(
  values: ApiProposalValues,
  clearCandidateSlots = false,
): ProposalHints {
  return {
    message: values.message,
    ...(clearCandidateSlots ? { candidateSlots: [] } : {}),
  };
}
