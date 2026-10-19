import { z } from "zod";
import { uuid, version } from "@/lib/http/contracts";

export const creditHint = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0);
const hintFields = {
  message: z.string(),
  exchangeTypeHint: z.enum(["ONE_WAY", "TWO_WAY"]).nullable().optional(),
  proposedCredit: creditHint.nullable().optional(),
  proposedDurationMinutes: z
    .number()
    .int()
    .min(60)
    .max(180)
    .nullable()
    .optional(),
  initialSessionCount: z.number().int().min(1).max(32767).nullable().optional(),
  candidateSlots: z.string().nullable().optional(),
};
export type ProposalHints = z.infer<z.ZodObject<typeof hintFields>>;
export const createInput = z
  .discriminatedUnion("sourceType", [
    z
      .object({
        ...hintFields,
        sourceType: z.literal("LEARNING_REQUEST"),
        learningRequestId: uuid,
      })
      .strict(),
    z
      .object({
        ...hintFields,
        sourceType: z.literal("DIRECT_SEARCH"),
        recipientSharingSkillId: uuid,
      })
      .strict(),
  ])
  .refine(
    (input) =>
      input.proposedCredit == null ||
      (!!input.exchangeTypeHint &&
        (input.exchangeTypeHint !== "TWO_WAY" ||
          Number(input.proposedCredit) >= 20)),
  );
// PATCH merges omitted fields with the saved proposal in BE. Cross-field
// validation belongs to the form's complete snapshot and the server transaction.
export const updateInput = z
  .object({ ...hintFields, expectedVersion: version })
  .strict();
export type ProposalInput = z.infer<typeof createInput>;
