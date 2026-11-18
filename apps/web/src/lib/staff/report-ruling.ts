import { StaffApiError } from "./client";
import type { ReportCaseDetail } from "./types";
import type { ResolutionDraft } from "./report-resolution";

export function reportRulingContext(item: ReportCaseDetail) {
  const status = item.session?.status ?? "";
  const attendanceCase = item.attendanceOutcome?.attendanceCase ?? "";
  const attendance =
    !!item.attendanceOutcome &&
    ["NO_SHOW", "DISPUTED", "MAKEUP_REQUIRED"].includes(status);
  const cancellation =
    !!item.session &&
    !item.attendanceOutcome &&
    ["DISPUTED", "MAKEUP_REQUIRED"].includes(status);
  const options = item.resolutionOptions;
  return {
    attendance,
    cancellation,
    required: status === "DISPUTED",
    allowUphold:
      status === "NO_SHOW" &&
      ["TEACHER_ABSENT", "LEARNER_ABSENT", "BOTH_ABSENT"].includes(
        attendanceCase,
      ),
    needsMakeupUser:
      attendance &&
      ["UNVERIFIABLE", "BOTH_PRESENT"].includes(attendanceCase) &&
      !options?.makeupAlreadyGranted &&
      !options?.obligationsEnded,
  };
}

/** Validate the selected business decision; never choose completion as a fallback. */
export function assertReportRuling(
  item: ReportCaseDetail,
  draft: ResolutionDraft,
  action: "resolve" | "reject" = "resolve",
) {
  const context = reportRulingContext(item);
  if (action === "reject") {
    if (context.required)
      throw new Error(
        "Buổi học đang chờ phán quyết. Hãy giải quyết vụ việc và chọn kết quả phù hợp với bằng chứng.",
      );
    return;
  }
  if (draft.noShowRuling && draft.cancellationMakeupRuling)
    throw new Error("Chỉ chọn một loại phán quyết buổi học.");
  if (
    context.required &&
    !draft.noShowRuling &&
    !draft.cancellationMakeupRuling
  )
    throw new Error("Chọn phán quyết buổi học trước khi xác nhận giải quyết.");
  if (draft.noShowRuling)
    assertNoShowRuling(item, draft.noShowRuling, draft.makeupUserId, context);
  if (draft.cancellationMakeupRuling)
    assertCancellationRuling(item, draft.cancellationMakeupRuling, context);
}

function assertMakeupParticipant(
  item: ReportCaseDetail,
  makeupUserId: string | undefined,
) {
  const userId = makeupUserId || item.reporterId;
  if (!userId)
    throw new Error(
      "Chọn người tham gia sử dụng lượt học bù trước khi xác nhận.",
    );
  if (![item.session?.teacherId, item.session?.learnerId].includes(userId))
    throw new StaffApiError(400, "MAKEUP_USER_NOT_PARTICIPANT");
  if (
    item.resolutionOptions &&
    !item.resolutionOptions.eligibleMakeupUserIds.includes(userId)
  ) {
    const quota = item.resolutionOptions.makeupQuotas.find(
      (row) => row.userId === userId,
    );
    throw new StaffApiError(409, quota?.reason ?? "USER_MAKEUP_LIMIT_REACHED");
  }
}
function assertNoShowRuling(
  item: ReportCaseDetail,
  ruling: NonNullable<ResolutionDraft["noShowRuling"]>,
  makeupUserId: string | undefined,
  context: ReturnType<typeof reportRulingContext>,
) {
  const option = item.resolutionOptions?.noShowRulings.find(
    (row) => row.value === ruling,
  );
  if (
    !context.attendance ||
    (ruling === "UPHOLD" && !context.allowUphold) ||
    (item.resolutionOptions && !option)
  )
    throw new StaffApiError(409, "NO_SHOW_RULING_NOT_APPLICABLE");
  if (option?.allowed === false)
    throw new StaffApiError(
      409,
      option.blockedReason ?? "NO_SHOW_RULING_NOT_APPLICABLE",
    );
  if (ruling === "EXCUSE" && context.needsMakeupUser)
    assertMakeupParticipant(item, makeupUserId);
}
function assertCancellationRuling(
  item: ReportCaseDetail,
  ruling: NonNullable<ResolutionDraft["cancellationMakeupRuling"]>,
  context: ReturnType<typeof reportRulingContext>,
) {
  const choices = item.resolutionOptions?.cancellationMakeupRulings;
  const option = choices?.find((row) => row.value === ruling);
  if (!context.cancellation || (choices && !option?.allowed))
    throw new StaffApiError(
      409,
      option?.blockedReason ?? "CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE",
    );
}

export function assertReportRulingCurrent(
  previous: ReportCaseDetail,
  current: ReportCaseDetail,
) {
  const snapshot = (item: ReportCaseDetail) =>
    JSON.stringify({
      caseStatus: item.status,
      handlerId: item.handlerId,
      incidentId: item.incidentId,
      status: item.session?.status,
      attendance: item.attendanceOutcome?.attendanceCase,
      options: item.resolutionOptions,
    });
  if (previous.id !== current.id || snapshot(previous) !== snapshot(current))
    throw new StaffApiError(409, "STALE_REPORT_CASE_VERSION");
}
