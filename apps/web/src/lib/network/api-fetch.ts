import { connectionStore, isConnectionFailure } from "./connection-store";

/** Observe our API clients, without intercepting assets or third-party requests. */
export async function apiFetch(input: string, options: RequestInit = {}) {
  try {
    if (options.signal?.aborted) options.signal.throwIfAborted();
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      throw new TypeError("Device is offline");
    const response = await fetch(input, options);
    if (response.status >= 500) {
      const value: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        value &&
        typeof value === "object" &&
        "message" in value &&
        isConnectionFailure({ code: value.message })
      )
        connectionStore.unavailable("unreachable");
    }
    return response;
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    connectionStore.unavailable(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : "unreachable",
    );
    throw error;
  }
}

/** A connection check never repeats the request that originally failed. */
export function retryConnection() {
  if (navigator.onLine !== false) connectionStore.deviceOnline();
  return connectionStore.retry(async () => {
    if (navigator.onLine === false) return false;
    const response = await fetch("/api/connection", {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(7000),
    });
    return response.ok;
  });
}
