import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";
import type { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import type { AttendancePolicy } from "../../domain/attendance.policy";

export async function lockSession(tx: TransactionContext, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT session_id AS id FROM sessions WHERE session_id = ${sessionId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("SESSION_NOT_FOUND");
}

/** Locks Path then Session (the order every Session writer uses) and rereads the row. */
export async function lockedSession(tx: TransactionContext, sessionId: string) {
  const initial = await tx.session.findUnique({ where: { id: sessionId } });
  if (!initial) throw new NotFoundException("SESSION_NOT_FOUND");
  await lockPath(tx, initial.pathId);
  await lockSession(tx, sessionId);
  return tx.session.findUniqueOrThrow({ where: { id: sessionId } });
}

export async function databaseNow(tx: TransactionContext) {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
  return clock.now;
}

export type AttendanceContext = {
  policy: AttendancePolicy;
  joinLateMinutes: number | null;
  liveKitEnabled: boolean;
};

async function optionalValue<
  K extends "session.attendancePolicy" | "livekit.joinWindow",
>(
  configuration: Pick<SystemConfigurationService, "getSnapshot">,
  key: K,
  tx?: TransactionContext,
) {
  try {
    return (await configuration.getSnapshot([key], tx)).values[key] ?? null;
  } catch (error) {
    if (error instanceof ServiceUnavailableException) return null;
    throw error;
  }
}

/** Null when the attendance policy is not ready: no Session is judged without it. */
export async function loadAttendanceContext(
  configuration: Pick<SystemConfigurationService, "getSnapshot">,
  liveKitEnabled: boolean,
  tx?: TransactionContext,
): Promise<AttendanceContext | null> {
  const policy = await optionalValue(
    configuration,
    "session.attendancePolicy",
    tx,
  );
  if (!policy) return null;
  const joinWindow = await optionalValue(
    configuration,
    "livekit.joinWindow",
    tx,
  );
  return {
    policy,
    joinLateMinutes: joinWindow?.lateMinutes ?? null,
    liveKitEnabled,
  };
}
