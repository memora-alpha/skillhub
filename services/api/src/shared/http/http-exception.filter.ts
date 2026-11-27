import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { failure } from "./response";
import { invalidScheduleDetails } from "./invalid-schedule-details";
import {
  safeRequestLog,
  safeServerErrorLog,
} from "../../configs/logging.config";
import {
  getOrCreateRequestContext,
  type ContextualRequest,
} from "./request-context";

// Only public capability codes are safe to expose for service-unavailable errors.
const publicUnavailableCodes = new Set([
  "CONNECTION_POLICY_UNAVAILABLE",
  "CHAT_REPLICA_SET_OR_INDEXES_UNAVAILABLE",
  "CHAT_STORE_UNAVAILABLE",
  "COMMITTED_DRAFT_MISSING",
  "MESSAGE_NOT_READY",
  "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
  "EVENT_CONNECTIONS_UNAVAILABLE",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "PAYMENT_CREATION_PAUSED",
  "PAYMENT_CHANNEL_RECONCILIATION_REQUIRED",
  "RECORDING_DISABLED",
  "RECORDING_UNAVAILABLE",
]);
const paymentRecoveryCodes = [
  "PAYMENT_UNRESOLVED",
  "PAYMENT_RECONCILIATION_REQUIRED",
];
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function clientMessage(
  status: number,
  exception: unknown,
  detail: unknown,
): unknown {
  const detailMessage =
    typeof detail === "string"
      ? detail
      : (detail as { message?: unknown } | undefined)?.message;
  if (status < 500) {
    const fallback =
      exception instanceof HttpException
        ? exception.message
        : "Request failed.";
    return detailMessage ?? fallback;
  }
  if (
    status === 503 &&
    typeof detailMessage === "string" &&
    publicUnavailableCodes.has(detailMessage)
  )
    return detailMessage;
  return "Internal server error";
}

function messageText(message: unknown): string {
  if (Array.isArray(message)) return message.join("; ");
  return typeof message === "string" ? message : "Request failed.";
}

// Only payment-owned UUIDs are exposed for these two explicit recovery errors.
function paymentDetails(status: number, text: string, detail: unknown) {
  const paymentId = (detail as { existingPaymentId?: unknown } | undefined)
    ?.existingPaymentId;
  return status === 409 &&
    paymentRecoveryCodes.includes(text) &&
    typeof paymentId === "string" &&
    uuidPattern.test(paymentId)
    ? { existingPaymentId: paymentId }
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function safeScheduleWindow(value: unknown, requireSessionId: boolean) {
  if (
    !isRecord(value) ||
    typeof value.planId !== "string" ||
    !uuidPattern.test(value.planId) ||
    !Number.isSafeInteger(value.sessionNo) ||
    (value.sessionNo as number) < 1 ||
    !isTimestamp(value.startAt) ||
    !isTimestamp(value.endAt) ||
    value.startAt >= value.endAt ||
    (requireSessionId &&
      (typeof value.sessionId !== "string" ||
        !uuidPattern.test(value.sessionId)))
  ) {
    return undefined;
  }
  return {
    ...(requireSessionId ? { sessionId: value.sessionId as string } : {}),
    planId: value.planId,
    sessionNo: value.sessionNo as number,
    startAt: value.startAt,
    endAt: value.endAt,
  };
}

function scheduleDetails(status: number, text: string, detail: unknown) {
  if (status !== 409 || text !== "SCHEDULE_CONFLICT" || !isRecord(detail))
    return undefined;
  const raw = detail.conflicts;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100)
    return undefined;
  const conflicts = raw.map((conflict) => {
    if (!isRecord(conflict)) return undefined;
    const type = conflict.type;
    const affectedUserIds = conflict.affectedUserIds;
    if (
      (type !== "INTERNAL" && type !== "SESSION") ||
      !Array.isArray(affectedUserIds) ||
      affectedUserIds.length < 1 ||
      affectedUserIds.length > 2 ||
      !affectedUserIds.every(
        (id) => typeof id === "string" && uuidPattern.test(id),
      ) ||
      new Set(affectedUserIds).size !== affectedUserIds.length ||
      !isTimestamp(conflict.overlapStartAt) ||
      !isTimestamp(conflict.overlapEndAt)
    ) {
      return undefined;
    }
    const proposed = safeScheduleWindow(conflict.proposed, false);
    const compared = safeScheduleWindow(conflict.compared, type === "SESSION");
    if (
      !proposed ||
      !compared ||
      conflict.overlapStartAt >= conflict.overlapEndAt ||
      conflict.overlapStartAt !==
        new Date(
          Math.max(Date.parse(proposed.startAt), Date.parse(compared.startAt)),
        ).toISOString() ||
      conflict.overlapEndAt !==
        new Date(
          Math.min(Date.parse(proposed.endAt), Date.parse(compared.endAt)),
        ).toISOString()
    ) {
      return undefined;
    }
    return {
      type,
      affectedUserIds,
      proposed,
      compared,
      overlapStartAt: conflict.overlapStartAt,
      overlapEndAt: conflict.overlapEndAt,
    };
  });
  return conflicts.every((conflict) => conflict !== undefined)
    ? { conflicts }
    : undefined;
}

function materialLifecycleDetails(
  status: number,
  text: string,
  detail: unknown,
) {
  if (
    status !== 409 ||
    (text !== "MATERIAL_VERSION_CONFLICT" &&
      text !== "MATERIAL_TRANSITION_INVALID") ||
    !isRecord(detail) ||
    !isRecord(detail.details)
  )
    return undefined;
  const { currentStatus, currentListingVersion } = detail.details;
  if (
    typeof currentStatus !== "string" ||
    ![
      "DRAFT",
      "PENDING_REVIEW",
      "PUBLISHED",
      "REJECTED",
      "HIDDEN",
      "ARCHIVED",
    ].includes(currentStatus) ||
    typeof currentListingVersion !== "number" ||
    !Number.isSafeInteger(currentListingVersion) ||
    currentListingVersion < 1
  )
    return undefined;
  return { currentStatus, currentListingVersion };
}

const whiteboardReadOnlyReasons = new Set([
  "SESSION_NOT_EDITABLE",
  "SESSION_UNDER_REPORT",
  "EDIT_WINDOW_NOT_OPEN",
  "EDIT_WINDOW_CLOSED",
]);

function whiteboardDetails(status: number, text: string, detail: unknown) {
  if (status !== 409 || !isRecord(detail)) return undefined;
  const { currentRevision, reason } = detail;
  if (
    text === "WHITEBOARD_REVISION_CONFLICT" &&
    typeof currentRevision === "number" &&
    Number.isSafeInteger(currentRevision) &&
    currentRevision >= 0
  )
    return { currentRevision };
  if (
    text === "WHITEBOARD_READ_ONLY" &&
    typeof reason === "string" &&
    whiteboardReadOnlyReasons.has(reason)
  )
    return { reason };
  return undefined;
}

// Spec 020: RECORDING_STATE_CONFLICT names the current recording status only.
const recordingStatuses = new Set([
  "REQUESTED",
  "DECLINED",
  "REQUEST_EXPIRED",
  "STARTING",
  "RECORDING",
  "STOPPING",
  "READY",
  "FAILED",
  "EXPIRED",
  "DELETED",
]);

function recordingDetails(status: number, text: string, detail: unknown) {
  if (
    status === 409 &&
    text === "RECORDING_STATE_CONFLICT" &&
    isRecord(detail) &&
    typeof detail.status === "string" &&
    recordingStatuses.has(detail.status)
  )
    return { status: detail.status };
  return undefined;
}

function publicErrorDetails(status: number, text: string, detail: unknown) {
  if (
    status === 409 &&
    text === "MATERIAL_REVIEW_NOT_ALLOWED" &&
    isRecord(detail) &&
    typeof detail.reason === "string" &&
    [
      "MATERIAL_NOT_PUBLISHED",
      "MATERIAL_OWNER_CANNOT_REVIEW",
      "MATERIAL_ACCESS_REQUIRED",
      "MATERIAL_PURCHASE_REQUIRED",
      "MATERIAL_ENTITLEMENT_REVOKED",
      "MATERIAL_REVIEW_ALREADY_EXISTS",
      "MATERIAL_REVIEW_HIDDEN",
    ].includes(detail.reason)
  )
    return { reason: detail.reason };
  if (text === "INVALID_SCHEDULE_ITEMS")
    return invalidScheduleDetails(status, text, detail);
  const schedule = scheduleDetails(status, text, detail);
  if (schedule) return schedule;
  const material = materialLifecycleDetails(status, text, detail);
  if (material) return material;
  const whiteboard = whiteboardDetails(status, text, detail);
  if (whiteboard) return whiteboard;
  const recording = recordingDetails(status, text, detail);
  if (recording) return recording;
  if (status === 409 && text === "INSUFFICIENT_AVAILABLE_CREDIT") {
    const userIds = (detail as { userIds?: unknown } | undefined)?.userIds;
    if (
      Array.isArray(userIds) &&
      userIds.length > 0 &&
      userIds.length <= 2 &&
      userIds.every((id) => typeof id === "string" && uuidPattern.test(id)) &&
      new Set(userIds).size === userIds.length
    ) {
      return { userIds };
    }
  }
  return paymentDetails(status, text, detail);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") throw exception;
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) {
      const request = host
        .switchToHttp()
        .getRequest<ContextualRequest & { method?: string; url?: string }>();
      this.logger.error({
        event: "http.server_error",
        statusCode: status,
        ...getOrCreateRequestContext(request),
        ...safeRequestLog(request),
        ...safeServerErrorLog(exception),
      });
    }
    const detail =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    if (status === 429 && isRecord(detail) && isRecord(detail.rateLimit)) {
      const limit = detail.rateLimit.limit;
      const remaining = detail.rateLimit.remaining;
      const resetSeconds = detail.rateLimit.resetSeconds;
      if (
        Number.isSafeInteger(limit) &&
        (limit as number) > 0 &&
        Number.isSafeInteger(remaining) &&
        (remaining as number) >= 0 &&
        Number.isSafeInteger(resetSeconds) &&
        (resetSeconds as number) > 0
      ) {
        response.setHeader("Retry-After", String(resetSeconds));
        response.setHeader("RateLimit-Limit", String(limit));
        response.setHeader("RateLimit-Remaining", String(remaining));
        response.setHeader("RateLimit-Reset", String(resetSeconds));
      }
    }
    const text = messageText(clientMessage(status, exception, detail));
    response
      .status(status)
      .json(failure(status, text, publicErrorDetails(status, text, detail)));
  }
}
