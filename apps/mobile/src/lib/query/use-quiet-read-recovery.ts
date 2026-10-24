import { useEffect, useRef } from "react";
import { AppError } from "../http/errors";
import { RATE_LIMIT_BACKOFF_MS } from "../http/rate-limit";

export function isTransientReadError(error: unknown): error is AppError {
  return (
    error instanceof AppError &&
    (error.kind === "network" || error.status === 429 || error.status >= 500)
  );
}

export function readRecoveryDelay(
  error: AppError,
  attempt: number,
  now = Date.now(),
) {
  if (error.status === 429)
    return Math.max(1000, (error.retryAt || now + RATE_LIMIT_BACKOFF_MS) - now);
  return Math.min(40_000, 5000 * 2 ** Math.min(attempt, 3));
}

// For idempotent screen reads only. A single timer follows the current error;
// focus/session guards and the query's in-flight coalescing remain with the caller.
export function useQuietReadRecovery({
  error,
  fetching,
  enabled,
  retry,
}: {
  error: unknown;
  fetching?: boolean;
  enabled: boolean;
  retry: () => unknown;
}) {
  const attempt = useRef(0);
  const latestRetry = useRef(retry);
  latestRetry.current = retry;
  useEffect(() => {
    if (!error) attempt.current = 0;
    if (!enabled || fetching || !isTransientReadError(error)) return;
    const timer = setTimeout(
      () => {
        attempt.current++;
        void Promise.resolve()
          .then(() => latestRetry.current())
          .catch(() => {});
      },
      readRecoveryDelay(error, attempt.current),
    );
    return () => clearTimeout(timer);
  }, [error, fetching, enabled]);
}
