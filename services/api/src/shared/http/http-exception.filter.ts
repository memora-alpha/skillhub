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
    const message =
      status >= 500
        ? "Internal server error"
        : typeof detail === "string"
          ? detail
          : ((detail as { message?: unknown } | undefined)?.message ??
            (exception instanceof HttpException
              ? exception.message
              : "Request failed."));
    response
      .status(status)
      .json(
        failure(
          status,
          Array.isArray(message)
            ? message.join("; ")
            : typeof message === "string"
              ? message
              : "Request failed.",
        ),
      );
  }
}
