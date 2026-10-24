import { AppError } from "./errors";

// This is a client backoff, not a claim about a server quota/reset time.
export const RATE_LIMIT_BACKOFF_MS = 60_000;

export function retryAfterAt(value: unknown, now = Date.now()): number {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds) && seconds <= 604800
      ? now + seconds * 1000
      : 0;
  }
  const date = Date.parse(text);
  return Number.isFinite(date) && date > now && date - now <= 604800000
    ? date
    : 0;
}

export function rateLimitUntil(error: unknown, now = Date.now()) {
  return error instanceof AppError && error.status === 429
    ? Math.max(now, error.retryAt || now + RATE_LIMIT_BACKOFF_MS)
    : 0;
}

// Smooth bursts across screens, independently of how fast the server responds.
// These are client scheduling values, not the server's quota.
const READ_START_LIMIT = 4;
const READ_WINDOW_MS = 1000;

type Job = { start(): void; rejectIfBlocked(): boolean };

export class RequestCoordinator {
  private active = 0;
  private readonly queue: Job[] = [];
  private readonly limits = new Map<string, AppError>();
  private readonly started: number[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly now = Date.now,
    private readonly concurrency = 4,
  ) {}

  check(path: string, method = "GET") {
    const endpoint = `${method}:${path.split("?")[0]}`;
    for (const key of ["*", endpoint]) {
      const error = this.limits.get(key);
      if (!error) continue;
      if (error.retryAt > this.now()) throw error;
      this.limits.delete(key);
    }
  }

  record(path: string, method: string, error: unknown) {
    if (!(error instanceof AppError) || error.status !== 429) return;
    // Business quotas have different dimensions; never turn them into an app-wide ban.
    if (
      [
        "CHAT_RATE_LIMIT",
        "PROPOSAL_RATE_LIMIT",
        "DIRECT_INVITATION_COOLDOWN",
      ].includes(error.code)
    )
      return;
    const key =
      error.code === "RATE_LIMITED" && !path.startsWith("/auth/")
        ? "*"
        : `${method}:${path.split("?")[0]}`;
    const next = new AppError(
      "http",
      429,
      error.code,
      rateLimitUntil(error, this.now()),
    );
    if ((this.limits.get(key)?.retryAt ?? 0) < next.retryAt)
      this.limits.set(key, next);
    this.pump();
  }

  async run<T>(
    path: string,
    method: string,
    signal: AbortSignal | undefined,
    read: () => Promise<T>,
  ): Promise<T> {
    this.check(path, method);
    const execute = async () => {
      if (signal?.aborted) throw new AppError("session");
      this.check(path, method);
      try {
        return await read();
      } catch (error) {
        this.record(path, method, error);
        throw error;
      }
    };
    if (method !== "GET") return execute();
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        const index = this.queue.indexOf(job);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new AppError("session"));
        this.pump();
      };
      const job: Job = {
        rejectIfBlocked: () => {
          try {
            this.check(path, method);
            return false;
          } catch (error) {
            signal?.removeEventListener("abort", abort);
            reject(error);
            return true;
          }
        },
        start: () => {
          signal?.removeEventListener("abort", abort);
          this.active++;
          void execute()
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.pump();
            });
        },
      };
      if (signal?.aborted) {
        reject(new AppError("session"));
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(job);
      this.pump();
    });
  }

  private pump() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const now = this.now();
    while (this.started.length && now - this.started[0]! >= READ_WINDOW_MS)
      this.started.shift();
    while (this.queue.length) {
      if (this.queue[0]!.rejectIfBlocked()) {
        this.queue.shift();
        continue;
      }
      if (this.active >= this.concurrency) return;
      if (this.started.length >= READ_START_LIMIT) {
        this.timer = setTimeout(
          () => this.pump(),
          Math.max(1, this.started[0]! + READ_WINDOW_MS - now),
        );
        return;
      }
      this.started.push(now);
      this.queue.shift()!.start();
    }
  }
}
