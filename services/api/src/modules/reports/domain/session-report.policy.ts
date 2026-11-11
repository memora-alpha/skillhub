type ReportableSession = {
  teacherId: string;
  learnerId: string;
  status: string;
};

/** Same precedence for the POST guard and participant-facing preflight. */
export function sessionReportBlockReason(
  session: ReportableSession,
  actorId: string,
  activeReport: boolean,
): string | null {
  if (actorId !== session.teacherId && actorId !== session.learnerId)
    return "SESSION_ACCESS_DENIED";
  if (session.status === "CANCELLED") return "SESSION_NOT_REPORTABLE";
  if (activeReport) return "ACTIVE_SESSION_REPORT_EXISTS";
  return null;
}

export function sessionReporting(input: {
  session: ReportableSession;
  actorId: string;
  activeReport: boolean;
  reportBy: Date | null;
  now: Date;
}) {
  let blockedReason = sessionReportBlockReason(
    input.session,
    input.actorId,
    input.activeReport,
  );
  if (!blockedReason && !input.reportBy)
    blockedReason = "REPORT_POLICY_UNAVAILABLE";
  if (!blockedReason && input.reportBy && input.now >= input.reportBy)
    blockedReason = "DISPUTE_WINDOW_CLOSED";
  return {
    canReport: blockedReason === null,
    blockedReason,
    reportBy: input.reportBy,
    evaluatedAt: input.now,
  };
}
