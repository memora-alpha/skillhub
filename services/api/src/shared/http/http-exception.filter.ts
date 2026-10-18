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
    let message: unknown = "Internal server error";
    if (status < 500) {
      if (typeof detail === "string") message = detail;
      else {
        const fallback =
          exception instanceof HttpException
            ? exception.message
            : "Request failed.";
        message =
          (detail as { message?: unknown } | undefined)?.message ?? fallback;
      }
    }
    // Only public capability codes are safe to expose for service-unavailable errors.
    if (
      status === 503 &&
      new Set([
        "CONNECTION_POLICY_UNAVAILABLE",
        "CHAT_REPLICA_SET_OR_INDEXES_UNAVAILABLE",
        "CHAT_STORE_UNAVAILABLE",
        "COMMITTED_DRAFT_MISSING",
        "MESSAGE_NOT_READY",
        "EVENT_CONNECTIONS_UNAVAILABLE",
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "PAYMENT_CREATION_PAUSED",
        "PAYMENT_CHANNEL_RECONCILIATION_REQUIRED",
      ]).has(
        typeof detail === "string"
          ? detail
          : ((detail as { message?: string } | undefined)?.message ?? ""),
      )
    )
      message =
        typeof detail === "string"
          ? detail
          : (detail as { message: string }).message;
    let text = "Request failed.";
    if (Array.isArray(message)) text = message.join("; ");
    else if (typeof message === "string") text = message;
    // Only payment-owned UUIDs are exposed for these two explicit recovery errors.
    const paymentId = (detail as { existingPaymentId?: unknown } | undefined)
      ?.existingPaymentId;
    const paymentDetails =
      status === 409 &&
      ["PAYMENT_UNRESOLVED", "PAYMENT_RECONCILIATION_REQUIRED"].includes(
        text,
      ) &&
      typeof paymentId === "string" &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(paymentId)
        ? { existingPaymentId: paymentId }
        : undefined;
    response.status(status).json(failure(status, text, paymentDetails));
  }
}
