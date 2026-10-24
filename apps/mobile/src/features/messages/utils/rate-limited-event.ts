import { AppError } from "@/lib/http/errors";
import { rateLimitUntil } from "@/lib/http/rate-limit";

export function waitForRetry(
  delay: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new AppError("session"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delay);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

// Retain the frame/cursor and the existing socket while REST hydration is limited.
export async function hydrateWithRateLimit(
  handle: () => Promise<void>,
  signal: AbortSignal,
  pause = waitForRetry,
): Promise<void> {
  if (signal.aborted) return;
  try {
    await handle();
  } catch (error) {
    if (!(error instanceof AppError && error.status === 429)) throw error;
    await pause(Math.max(1, rateLimitUntil(error) - Date.now()), signal);
    return hydrateWithRateLimit(handle, signal, pause);
  }
}
