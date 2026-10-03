import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      status >= 500
        ? "Service unavailable"
        : typeof detail === "string"
          ? detail
          : ((detail as { message?: unknown } | undefined)?.message ??
            "Request failed");
    response.status(status).json({ error: { statusCode: status, message } });
  }
}
