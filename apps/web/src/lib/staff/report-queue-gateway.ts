import { GatewayError, type BackendReply } from "../gateway/upstream";
import { reportQueueOrigins } from "./report-queue-origin";

export const reportQueueStatuses = [
  "OPEN",
  "UNDER_REVIEW",
  "NEED_MORE_INFO",
  "RESOLVED",
  "REJECTED",
] as const;

type Cursor = {
  version: 1;
  scope: string;
  index: number;
  upstream: string | null;
};
type Page = { nextCursor: string | null; hasMore: boolean };
function invalidCursor(): never {
  throw new GatewayError(400, "INVALID_REPORT_QUEUE_CURSOR");
}
function readCursor(
  value: string | null,
  scope: string,
  count: number,
): Cursor {
  if (!value) return { version: 1, scope, index: 0, upstream: null };
  try {
    if (value.length > 8192) return invalidCursor();
    const row = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      !row ||
      row.version !== 1 ||
      row.scope !== scope ||
      !Number.isSafeInteger(row.index) ||
      row.index < 0 ||
      row.index >= count ||
      (row.upstream !== null &&
        (typeof row.upstream !== "string" ||
          !row.upstream ||
          row.upstream.length > 1024))
    )
      return invalidCursor();
    return row as Cursor;
  } catch {
    return invalidCursor();
  }
}
function pagination(value: unknown): Page {
  if (!value || typeof value !== "object" || !("pagination" in value))
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  const page = value.pagination;
  if (
    !page ||
    typeof page !== "object" ||
    !("hasMore" in page) ||
    typeof page.hasMore !== "boolean" ||
    !("nextCursor" in page) ||
    (page.nextCursor !== null &&
      (typeof page.nextCursor !== "string" ||
        !page.nextCursor ||
        page.nextCursor.length > 1024)) ||
    page.hasMore !== (page.nextCursor !== null)
  )
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  return page as Page;
}

/** Adapt the web's tabs to the existing API without forwarding new filters. */
export async function reportQueueGateway(
  query: URLSearchParams,
  actorId: string,
  readPage: (query: URLSearchParams) => Promise<BackendReply>,
  readDetail: (id: string) => Promise<unknown>,
): Promise<BackendReply> {
  const limit = Number(query.get("limit") ?? "20");
  const source = query.get("source") || "";
  const status = query.get("status") || "";
  const contentReview = query.get("contentReview") || "";
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (source && source !== "USER" && source !== "SYSTEM") ||
    (contentReview &&
      contentReview !== "REQUIRED" &&
      contentReview !== "PENDING") ||
    (status &&
      status !== "ALL" &&
      !reportQueueStatuses.includes(
        status as (typeof reportQueueStatuses)[number],
      ))
  )
    throw new GatewayError(400, "INVALID_REPORT_QUEUE_FILTER");
  // The legacy API defaults to the three open statuses when status is omitted.
  const statuses = status === "ALL" ? [...reportQueueStatuses] : [status];
  const scope = JSON.stringify([
    actorId,
    limit,
    source,
    status,
    query.get("severity") || null,
    query.get("handlerId") || null,
    contentReview || null,
  ]);
  let cursor: Cursor | null = readCursor(
    query.get("cursor"),
    scope,
    statuses.length,
  );
  const seen = new Set<string>();
  let originPages = 0;
  // Skip empty states, but bound both queue reads and private-detail fan-out.
  for (let attempt = 0; attempt < 5; attempt++) {
    const active: Cursor = cursor;
    const upstream = new URLSearchParams({ limit: String(limit) });
    if (statuses[active.index]) upstream.set("status", statuses[active.index]!);
    for (const key of ["severity", "handlerId", "contentReview"])
      if (query.get(key)) upstream.set(key, query.get(key)!);
    if (active.upstream) upstream.set("cursor", active.upstream);
    const result = await readPage(upstream);
    if (result.status !== 200 || !result.value?.success) return result;
    const value = result.value as NonNullable<BackendReply["value"]> & {
      meta?: unknown;
    };
    const page = pagination(value.meta);
    if (!Array.isArray(value.data) || value.data.length > limit)
      throw new GatewayError(502, "API_RESPONSE_INVALID");
    if (
      page.nextCursor &&
      (page.nextCursor === active.upstream || seen.has(page.nextCursor))
    )
      throw new GatewayError(502, "API_RESPONSE_INVALID");
    if (page.nextCursor) seen.add(page.nextCursor);
    cursor = null;
    if (page.nextCursor) cursor = { ...active, upstream: page.nextCursor };
    else if (active.index + 1 < statuses.length)
      cursor = { ...active, index: active.index + 1, upstream: null };
    if (value.data.length) originPages++;
    const rows = await reportQueueOrigins(value.data, readDetail);
    const visible = source ? rows.filter((row) => row.source === source) : rows;
    if (visible.length || !cursor || originPages >= 2 || attempt === 4) {
      return {
        status: 200,
        value: {
          ...value,
          data: visible,
          meta: {
            pagination: {
              limit,
              hasMore: cursor !== null,
              nextCursor: cursor
                ? Buffer.from(JSON.stringify(cursor)).toString("base64url")
                : null,
            },
          },
        },
      } as BackendReply;
    }
  }
  throw new GatewayError(502, "API_RESPONSE_INVALID");
}
