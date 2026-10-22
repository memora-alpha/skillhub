// A ready frame alone does not prove a healthy connection: a replayed bad event
// can fail immediately afterwards. Reset only after 30 seconds of stability.
export function createEventRetryBudget(now: () => number = Date.now) {
  let failures = 0,
    readyAt: number | undefined;
  return {
    ready: () => {
      readyAt = now();
    },
    reset: () => {
      failures = 0;
      readyAt = undefined;
    },
    failed: () => {
      if (readyAt !== undefined && now() - readyAt >= 30000) failures = 0;
      readyAt = undefined;
      failures++;
      return failures <= 6
        ? Math.min(30000, 3000 * 2 ** (failures - 1))
        : undefined;
    },
  };
}
