import { AppError } from "./errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readPayload(
  status: number,
  payload: unknown,
  includeMeta = false,
): unknown {
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
  return includeMeta
    ? { data: payload.data, meta: payload.meta }
    : payload.data;
}
