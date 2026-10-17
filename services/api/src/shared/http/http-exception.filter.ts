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
      typeof detail === "string" &&
      new Set([
        "CONNECTION_POLICY_UNAVAILABLE",
        "CHAT_REPLICA_SET_OR_INDEXES_UNAVAILABLE",
        "CHAT_STORE_UNAVAILABLE",
        "COMMITTED_DRAFT_MISSING",
        "MESSAGE_NOT_READY",
        "EVENT_CONNECTIONS_UNAVAILABLE",
        "PAYMENT_PROVIDER_UNAVAILABLE",
      ]).has(detail)
    )
      message = detail;
    let text = "Request failed.";
    if (Array.isArray(message)) text = message.join("; ");
    else if (typeof message === "string") text = message;
    response.status(status).json(failure(status, text));
  }
}
