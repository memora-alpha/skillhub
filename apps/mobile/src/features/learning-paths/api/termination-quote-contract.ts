import { z } from "zod";
import { uuid } from "@/lib/http/contracts";
import { credit } from "./path-changes-contract";

const count = z.number().int().nonnegative();
export const terminationQuote = z.object({
  pathId: uuid,
  status: z.enum(["NOT_LOCKED", "BLOCKED", "READY"]),
  reasonCodes: z.array(z.string()),
  totalSessions: count,
  completedSessions: count,
  allocations: z
    .array(
      z.object({
        allocationId: uuid,
        userId: uuid,
        refund: credit,
        counterpartyPayment: credit,
        platformFee: credit,
        compensationCredit: credit,
      }),
    )
    .max(2),
});
export type TerminationQuote = z.infer<typeof terminationQuote>;
