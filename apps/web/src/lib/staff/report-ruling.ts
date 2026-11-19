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
  const makeupAlreadyGranted =
    options?.makeupAlreadyGranted ??
    item.attendanceOutcome?.evidence?.makeupGranted === true;
  return {
    attendance,
    cancellation,
    required: status === "DISPUTED",
    makeupAlreadyGranted,
    allowUphold:
      status === "NO_SHOW" &&
      ["TEACHER_ABSENT", "LEARNER_ABSENT", "BOTH_ABSENT"].includes(
        attendanceCase,
      ),
    needsMakeupUser:
      attendance &&
      ["UNVERIFIABLE", "BOTH_PRESENT"].includes(attendanceCase) &&
      !makeupAlreadyGranted &&
      !options?.obligationsEnded,
  };
}

/** Missing server capabilities must not imply permission to reserve another makeup. */
export function reportRulingAvailable(
  item: ReportCaseDetail,
  ruling: "UPHOLD" | "EXCUSE" | "COMPLETE",
) {
  const context = reportRulingContext(item);
  if (!context.attendance || (ruling === "UPHOLD" && !context.allowUphold))
    return false;
  if (item.resolutionOptions)
    return item.resolutionOptions.noShowRulings.some(
      (option) => option.value === ruling && option.allowed,
    );
  return (
    ruling === "COMPLETE" ||
    context.makeupAlreadyGranted ||
    (ruling === "UPHOLD" &&
      item.attendanceOutcome?.attendanceCase === "LEARNER_ABSENT")
  );
}

export function cancellationRulingAvailable(
  item: ReportCaseDetail,
  ruling: "EXTEND" | "COMPLETE",
  scope: "case" | "incident" = "case",
) {
  return (
    scope === "case" &&
    reportRulingContext(item).cancellation &&
    item.resolutionOptions?.cancellationMakeupRulings?.some(
      (option) => option.value === ruling && option.allowed,
    ) === true
  );
}

/** Validate the selected business decision; never choose completion as a fallback. */
export function assertReportRuling(
  item: ReportCaseDetail,
  draft: ResolutionDraft,
  action: "resolve" | "reject" = "resolve",
  scope: "case" | "incident" = "case",
) {
  const context = reportRulingContext(item);
  if (scope === "incident" && draft.cancellationMakeupRuling)
    throw new Error(
      "API vụ việc chung chưa hỗ trợ quyết định cho buổi đã hủy. Không thể gửi phương án này.",
    );
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
  if (
    (draft.noShowRuling === "COMPLETE" ||
      draft.cancellationMakeupRuling === "COMPLETE") &&
    !draft.completionEvidenceConfirmed
  )
    throw new Error(
      "Xác nhận đã kiểm tra bằng chứng buổi học hoàn thành trước khi lưu.",
    );
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
  ruling: Exclude<ResolutionDraft["noShowRuling"], "" | undefined>,
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
  if (!reportRulingAvailable(item, ruling))
    throw new Error(
      "Chưa có dữ liệu xác nhận hạn mức học bù. Cần bộ phận kỹ thuật bổ sung điều kiện xử lý; không chọn hoàn thành chỉ để đóng báo cáo.",
    );
  if (ruling === "EXCUSE" && context.needsMakeupUser)
    assertMakeupParticipant(item, makeupUserId);
}
function assertCancellationRuling(
  item: ReportCaseDetail,
  ruling: Exclude<ResolutionDraft["cancellationMakeupRuling"], "" | undefined>,
  context: ReturnType<typeof reportRulingContext>,
) {
  const choices = item.resolutionOptions?.cancellationMakeupRulings;
  const option = choices?.find((row) => row.value === ruling);
  if (context.cancellation && !choices)
    throw new Error(
      "Chưa có dữ liệu xác nhận điều kiện xử lý buổi đã hủy. Cần bộ phận kỹ thuật bổ sung trước khi quyết định.",
    );
  if (!context.cancellation || !cancellationRulingAvailable(item, ruling))
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
      sessionId: item.session?.id,
      teacherId: item.session?.teacherId,
      learnerId: item.session?.learnerId,
      pathStatus: item.path?.status,
      settledAt: item.path?.settledAt,
      status: item.session?.status,
      attendance: item.attendanceOutcome?.attendanceCase,
      attendanceStatus: item.attendanceOutcome?.status,
      attendanceResolution: item.attendanceOutcome?.resolution,
      makeupGranted: item.attendanceOutcome?.evidence?.makeupGranted === true,
      options: item.resolutionOptions,
    });
  if (previous.id !== current.id || snapshot(previous) !== snapshot(current))
    throw new StaffApiError(409, "STALE_REPORT_CASE_VERSION");
}
