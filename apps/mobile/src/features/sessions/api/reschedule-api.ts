import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  parse,
  resourcePath,
  timestamp,
  uuid,
  version,
} from "@/lib/http/contracts";

const inputSchema = z
  .strictObject({
    expectedVersion: version.max(Number.MAX_SAFE_INTEGER - 1),
    startAt: timestamp,
    endAt: timestamp,
  })
  .refine(({ startAt, endAt }) => {
    const minutes = (Date.parse(endAt) - Date.parse(startAt)) / 60_000;
    return Number.isFinite(minutes) && minutes >= 60 && minutes <= 180;
  });
const proposalReceipt = z.object({
  id: uuid,
  version,
  status: z.literal("NEEDS_REVISION"),
});
const confirmationReceipt = z
  .object({
    id: uuid,
    version,
    bothConfirmed: z.boolean(),
    status: z.enum(["PARTIALLY_CONFIRMED", "LOCKED"]),
  })
  .refine((value) => value.bothConfirmed === (value.status === "LOCKED"));

export type RescheduleInput = z.infer<typeof inputSchema>;
export type RescheduleReceipt =
  z.infer<typeof proposalReceipt> | z.infer<typeof confirmationReceipt>;

export function createRescheduleApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async proposeReschedule(sessionId: string, input: RescheduleInput) {
      const body = parse(inputSchema, input);
      const result = parse(
        proposalReceipt,
        await call(
          `${resourcePath("sessions", sessionId)}/reschedule-proposals`,
          { method: "POST", body, replayAfterRenewal: false },
        ),
      );
      if (result.version !== body.expectedVersion + 1)
        throw new AppError("protocol");
      return result;
    },
    async confirmReschedule(scheduleId: string, expectedVersion: number) {
      parse(version, expectedVersion);
      const result = parse(
        confirmationReceipt,
        await call(
          `${resourcePath("schedule-proposals", scheduleId)}/confirm`,
          {
            method: "POST",
            body: { expectedVersion },
            replayAfterRenewal: false,
          },
        ),
      );
      if (result.id !== scheduleId || result.version !== expectedVersion)
        throw new AppError("protocol");
      return result;
    },
  };
}
