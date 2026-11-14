import { z } from "zod";
import { parse } from "@/lib/http/contracts";
import type { RequestOptions } from "@/lib/http/client";

export const claimableMission = z.enum([
  "GOOD_BEHAVIOR_STREAK",
  "COMMITMENT_RECOVERY",
]);
const points = z.number().int().min(0).max(100);
export const recoverySchema = z.object({
  eligible: z.boolean(),
  remainingBudget: points,
  missions: z
    .array(
      z.object({
        code: z.enum(["POLICY_AWARENESS", ...claimableMission.options]),
        reward: points,
        claimed: z.boolean(),
        progress: z.object({
          current: z.number().int().nonnegative(),
          target: z.number().int().positive(),
          complete: z.boolean(),
        }),
      }),
    )
    .max(3),
  quiz: z
    .object({
      version: z.string().min(1).max(20),
      questions: z.array(z.string().min(1)).min(1).max(5),
      policy: z.array(z.string().min(1)).min(1),
    })
    .nullable(),
});
const result = z.object({ passed: z.boolean(), awarded: points });
export type Recovery = z.infer<typeof recoverySchema>;
export type RecoveryResult = z.infer<typeof result>;
export function createRecoveryApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  async function post(path: string, body: unknown) {
    return parse(
      result,
      await call(`/reputation/recovery/${path}`, {
        method: "POST",
        body,
        replayAfterRenewal: false,
      }),
    );
  }
  return {
    async read(signal?: AbortSignal) {
      return parse(
        recoverySchema,
        await call("/reputation/recovery", { signal }),
      );
    },
    quiz(version: string, answers: boolean[]) {
      return post(
        "quiz",
        parse(
          z.object({
            version: z.string().min(1).max(20),
            answers: z.array(z.boolean()).min(1).max(5),
          }),
          { version, answers },
        ),
      );
    },
    claim(code: string) {
      return post("claim", { code: parse(claimableMission, code) });
    },
  };
}
