import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { failure } from "./response";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") throw exception;
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
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
    let text = "Request failed.";
    if (Array.isArray(message)) text = message.join("; ");
    else if (typeof message === "string") text = message;
    response.status(status).json(failure(status, text));
  }
}
