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
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(paymentId)
    ? { existingPaymentId: paymentId }
    : undefined;
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
      .json(failure(status, text, paymentDetails(status, text, detail)));
  }
}
