import { AppError } from "./errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AppError(response.ok ? "protocol" : "http", response.status);
  }
  if (!response.ok) {
    // Only accept known-shaped codes, never display arbitrary server text or details.
    const code =
      isRecord(payload) &&
      typeof payload.message === "string" &&
      /^[A-Z_]+$/.test(payload.message)
        ? payload.message
        : "";
    throw new AppError("http", response.status, code);
  }
  if (!isRecord(payload) || payload.success !== true || !("data" in payload))
    throw new AppError("protocol");
  return payload.data;
}
