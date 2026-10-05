import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

export type RequestContext = {
  requestId: string;
  correlationId: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRequestContext(
  headers: IncomingHttpHeaders,
): RequestContext {
  const supplied = headers["x-correlation-id"];
  return {
    requestId: randomUUID(),
    correlationId:
      typeof supplied === "string" && uuidPattern.test(supplied)
        ? supplied.toLowerCase()
        : randomUUID(),
  };
}

export type ContextualRequest = {
  headers: IncomingHttpHeaders;
  requestContext?: RequestContext;
};

export function getOrCreateRequestContext(
  request: ContextualRequest,
): RequestContext {
  return (request.requestContext ??= createRequestContext(request.headers));
}
