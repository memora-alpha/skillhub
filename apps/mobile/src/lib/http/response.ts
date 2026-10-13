import { AppError } from "./errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readPayload(status: number, payload: unknown): unknown {
  if (status === 204) return undefined;
  if (status < 200 || status >= 300) {
    // Only accept known-shaped codes, never display arbitrary server text or details.
    const code =
      isRecord(payload) &&
      typeof payload.message === "string" &&
      /^[A-Z_]+$/.test(payload.message)
        ? payload.message
        : "";
    throw new AppError("http", status, code);
  }
  if (!isRecord(payload) || payload.success !== true || !("data" in payload))
    throw new AppError("protocol");
  return payload.data;
}

export type Page<T> = {
  data: T[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
};

export function readPagePayload(
  status: number,
  payload: unknown,
): Page<unknown> {
  const data = readPayload(status, payload);
  const meta = isRecord(payload) ? payload.meta : null;
  const page = isRecord(meta) ? meta.pagination : null;
  if (
    !Array.isArray(data) ||
    !isRecord(page) ||
    !Number.isInteger(page.limit) ||
    Number(page.limit) < 1 ||
    Number(page.limit) > 50 ||
    typeof page.hasMore !== "boolean" ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === "string" && page.nextCursor.length > 0)
    ) ||
    (page.hasMore && !page.nextCursor) ||
    (!page.hasMore && page.nextCursor !== null)
  )
    throw new AppError("protocol");
  return {
    data,
    pagination: {
      limit: Number(page.limit),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor as string | null,
    },
  };
}
