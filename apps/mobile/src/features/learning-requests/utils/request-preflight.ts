import { AppError } from "@/lib/http/errors";
import type { OwnerRequest, PublicRequestDetail } from "../types";
import {
  cancelableRequest,
  editableRequest,
  isOwnRequest,
  requestState,
} from "./request-policy";

export function needsExpiryRead(request: OwnerRequest, now = Date.now()) {
  return (
    ["OPEN", "PENDING_MODERATION"].includes(requestState(request)) &&
    !!request.expiresAt &&
    Date.parse(request.expiresAt) <= now
  );
}
export type PreflightResult = {
  kind: "ready" | "changed" | "readonly";
  request: OwnerRequest;
};
export async function requestPreflight(
  request: OwnerRequest,
  operation: "edit" | "cancel" | "publish",
  read: () => Promise<OwnerRequest | PublicRequestDetail>,
  isCurrent = () => true,
  now = Date.now(),
): Promise<PreflightResult> {
  if (!isCurrent()) throw new AppError("session");
  const result = needsExpiryRead(request, now) ? await read() : request;
  if (!isCurrent()) throw new AppError("session");
  if (result.id !== request.id) throw new AppError("protocol");
  if (!isOwnRequest(result)) throw new AppError("http", 403);
  const allowed =
    operation === "edit"
      ? editableRequest(result)
      : operation === "cancel"
        ? cancelableRequest(result)
        : requestState(result) === "DRAFT";
  if (!allowed) return { kind: "readonly", request: result };
  if (
    result.version !== request.version ||
    result.publishedAt !== request.publishedAt
  )
    return { kind: "changed", request: result };
  return { kind: "ready", request: result };
}
