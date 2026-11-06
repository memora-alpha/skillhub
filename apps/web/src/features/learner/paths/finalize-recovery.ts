import type { LearningPath, Reply } from "../types";
import type { UserRequestOptions } from "../api/client";
import { UserApiError } from "../api/client";
type Request = <T>(
  path: string,
  options?: UserRequestOptions,
) => Promise<Reply<T>>;
export function commitmentSnapshot(path: LearningPath) {
  return JSON.stringify({
    version: path.currentVersion,
    agreement: path.agreement,
    plans: [...path.plans]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((plan) => ({
        id: plan.id,
        version: plan.version,
        teacherId: plan.teacherId,
        learnerId: plan.learnerId,
        confirmed: plan.learnerConfirmedAt,
        schedule: plan.schedule
          ? {
              ...plan.schedule,
              items: [...plan.schedule.items].sort(
                (a, b) => a.sessionNo - b.sessionNo,
              ),
            }
          : null,
      })),
  });
}
export type FinalizeIntent = {
  pathId: string;
  version: number;
  key: string;
  signature: string;
  snapshot: LearningPath;
};
export function reviewedFinalizeIntent(
  previous: FinalizeIntent,
  current: LearningPath,
) {
  if (current.id !== previous.pathId || current.lockedVersion !== null)
    throw new UserApiError(409, "STALE_COMMITMENT_SNAPSHOT");
  // expectedVersion is the only wire field: retain the original key whenever
  // that payload is unchanged, even when reviewed schedule content changed.
  if (current.currentVersion !== previous.version) return null;
  return {
    ...previous,
    snapshot: current,
    signature: commitmentSnapshot(current),
  };
}
export async function readFinalizePath(request: Request, pathId: string) {
  const value = (await request<LearningPath>("learning-paths/" + pathId)).data;
  if (
    value?.id !== pathId ||
    !Number.isSafeInteger(value.currentVersion) ||
    !(
      value.lockedVersion === null ||
      (Number.isSafeInteger(value.lockedVersion) && value.lockedVersion! > 0)
    ) ||
    !value.agreement ||
    !Array.isArray(value.plans) ||
    !value.plans.every((plan) => Array.isArray(plan.sessions))
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return value;
}
export async function finalizeWithRecovery(
  request: Request,
  intent: FinalizeIntent,
) {
  const read = () => readFinalizePath(request, intent.pathId);
  const current = await read();
  if (current.lockedVersion !== null) return { path: current, recovered: true };
  if (
    current.currentVersion !== intent.version ||
    commitmentSnapshot(current) !== intent.signature
  )
    throw new UserApiError(409, "STALE_COMMITMENT_SNAPSHOT");
  try {
    await request("learning-paths/" + intent.pathId + "/final-validation", {
      method: "POST",
      body: {},
    });
    await request("learning-paths/" + intent.pathId + "/finalize", {
      method: "POST",
      key: intent.key,
      body: { expectedVersion: intent.version },
    });
    return { path: await read(), recovered: false };
  } catch (cause) {
    // A lost response must never turn into a new commitment intent.
    if (
      !(cause instanceof UserApiError) ||
      cause.status === 0 ||
      cause.status === 408 ||
      cause.status >= 500 ||
      cause.code === "COMMAND_UNCERTAIN"
    ) {
      try {
        const latest = await read();
        if (latest.lockedVersion !== null)
          return { path: latest, recovered: true };
      } catch {
        /* Keep the original error and the same intent for later recovery. */
      }
    }
    throw cause;
  }
}
