import { z } from "zod";

// Caller-scoped capabilities returned by participant case summaries/lists.
export const caseCapabilities = z.object({
  hasHandler: z.boolean(),
  ownEvidenceCount: z.number().int().nonnegative(),
  canSendMessage: z.boolean(),
  messageBlockedReason: z.string().nullable(),
  canAttachEvidence: z.boolean(),
  evidenceBlockedReason: z.string().nullable(),
});
export type CaseCapabilities = z.infer<typeof caseCapabilities>;
