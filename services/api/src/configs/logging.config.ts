import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getOrCreateRequestContext,
  type ContextualRequest,
} from "../shared/http/request-context";

type LogRequest = IncomingMessage & ContextualRequest & { id?: string };

export function requestLogId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const context = getOrCreateRequestContext(request as LogRequest);
  response.setHeader("x-request-id", context.requestId);
  response.setHeader("x-correlation-id", context.correlationId);
  return context.requestId;
}

export function requestLogProperties(request: IncomingMessage) {
  return {
    correlationId: getOrCreateRequestContext(request as LogRequest)
      .correlationId,
  };
}

export function safeRequestLog(request: {
  id?: string;
  method?: string;
  url?: string;
}) {
  const rawPath = request.url?.split("?")[0] ?? "/";
  return { id: request.id, method: request.method, path: rawPath };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value))
    return value as Record<string, unknown>;
  return {};
}

function serverErrorFrames(exception: unknown): string[] {
  if (!(exception instanceof Error) || typeof exception.stack !== "string")
    return [];
  const header = `${exception.name}: ${exception.message}\n`;
  if (!exception.stack.startsWith(header)) return [];
  // Remove the complete message, including embedded newlines, before keeping frames.
  return exception.stack
    .slice(header.length)
    .split("\n")
    .filter((line) => /^\s+at\b/.test(line))
    .slice(0, 8)
    .map((line) => line.trim());
}

/** Prisma messages can contain SQL values and credentials; log diagnostics only. */
export function safeServerErrorLog(exception: unknown) {
  const error = record(exception);
  const meta = record(error.meta);
  const cause = record(record(meta.driverAdapterError).cause);
  const name =
    exception instanceof Error ? exception.constructor.name : "UnknownError";
  const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name)
    ? name
    : "UnknownError";
  const errorCode =
    typeof error.code === "string" && /^P\d{4}$/.test(error.code)
      ? error.code
      : undefined;
  const databaseCode =
    typeof cause.originalCode === "string" &&
    /^[A-Z0-9]{5}$/.test(cause.originalCode)
      ? cause.originalCode
      : undefined;
  let missingColumn: string | undefined;
  if (databaseCode === "42703" && typeof cause.originalMessage === "string") {
    // Accept only PostgreSQL's missing-column template, never arbitrary messages.
    missingColumn =
      /^column "?([A-Za-z_][A-Za-z0-9_.]{0,127})"? does not exist$/.exec(
        cause.originalMessage,
      )?.[1];
  }
  return {
    errorType,
    errorCode,
    databaseCode,
    missingColumn,
    stackFrames: serverErrorFrames(exception),
  };
}
