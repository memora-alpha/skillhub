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
