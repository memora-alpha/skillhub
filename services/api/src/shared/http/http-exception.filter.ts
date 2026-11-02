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
  "EVENT_CONNECTIONS_UNAVAILABLE",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "PAYMENT_CREATION_PAUSED",
  "PAYMENT_CHANNEL_RECONCILIATION_REQUIRED",
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

function publicErrorDetails(status: number, text: string, detail: unknown) {
  const schedule = scheduleDetails(status, text, detail);
  if (schedule) return schedule;
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
    const text = messageText(clientMessage(status, exception, detail));
    response
      .status(status)
      .json(failure(status, text, publicErrorDetails(status, text, detail)));
  }
}
