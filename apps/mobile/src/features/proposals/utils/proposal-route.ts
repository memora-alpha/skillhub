import { z } from "zod";
import { uuid } from "@/lib/http/contracts";

export function proposalId(value: unknown): string | null {
  const result = uuid.safeParse(value);
  return result.success ? result.data : null;
}
const source = z.union([
  z.object({
    requestId: uuid,
    userId: uuid.optional(),
    sharingSkillId: z.undefined().optional(),
  }),
  z.object({
    requestId: z.undefined().optional(),
    userId: uuid,
    sharingSkillId: uuid,
  }),
]);
export function proposalSource(params: unknown) {
  const result = source.safeParse(params);
  return result.success ? result.data : null;
}
const listFilter = z
  .object({
    tab: z.enum(["sent", "received"]).optional(),
    status: z
      .enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"])
      .optional(),
    learningRequestId: uuid.optional(),
  })
  .refine((value) => !value.learningRequestId || value.tab !== "sent");
export function proposalListFilter(params: unknown) {
  const result = listFilter.safeParse(params);
  return result.success
    ? { ...result.data, direction: result.data.tab ?? "received" }
    : null;
}
