import type { LearningSession } from "../types";

export function sessionMakeupState(
  session: LearningSession,
  now: number,
  pathStatus?: string,
): "waiting" | "processing" | "available" | "closed" | "blocked" | null {
  const bothAbsent = session.attendance?.case === "BOTH_ABSENT";
  if (
    session.status !== "MAKEUP_REQUIRED" &&
    !(bothAbsent && ["NO_SHOW", "DISPUTED"].includes(session.status))
  )
    return null;
  if (
    session.status === "DISPUTED" ||
    session.attendance?.outcomeStatus === "DISPUTED" ||
    (pathStatus !== undefined && !["SCHEDULED", "ACTIVE"].includes(pathStatus))
  )
    return "blocked";
  if (session.status === "MAKEUP_REQUIRED") {
    const deadline = Date.parse(session.deadlines?.makeupBy ?? "");
    if (Number.isFinite(deadline) && now >= deadline) return "closed";
    // Granting a makeup already reserves the allowance. Remaining quota can be zero.
    return session.allowedActions?.includes("PROPOSE_MAKEUP")
      ? "available"
      : "processing";
  }
  const deadline = Date.parse(session.deadlines?.excuseOrReportBy ?? "");
  return session.attendance?.outcomeStatus === "PROVISIONAL" &&
    (!Number.isFinite(deadline) || now < deadline)
    ? "waiting"
    : "processing";
}
