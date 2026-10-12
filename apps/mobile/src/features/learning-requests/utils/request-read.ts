import { AppError } from "@/lib/http/errors";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type ReadDenial = "unavailable" | "forbidden";
export function readDenial(error: unknown): ReadDenial | undefined {
  if (!(error instanceof AppError)) return;
  if (error.status === 404) return "unavailable";
  if (error.status === 403) return "forbidden";
}

// Per-resource/session read state, not an entity cache. A transient error after
// denial must not make the old cached private projection visible again.
export class RequestReadGuard {
  denial: ReadDenial | undefined;
  private sequence = 0;
  fail(error: unknown) {
    this.denial = readDenial(error) ?? this.denial;
  }
  async read<T>(load: () => Promise<T>, isCurrent = () => true): Promise<T> {
    const ticket = ++this.sequence;
    if (!isCurrent()) throw new AppError("session");
    try {
      const result = await load();
      if (!isCurrent()) throw new AppError("session");
      if (ticket === this.sequence) this.denial = undefined;
      return result;
    } catch (error) {
      if (isCurrent() && ticket === this.sequence) this.fail(error);
      throw error;
    }
  }
}
export function requestReadGuard(client: QueryClient, key: QueryKey) {
  const stored = client.getQueryCache().find({ queryKey: key, exact: true })
    ?.meta?.requestReadGuard;
  return stored instanceof RequestReadGuard ? stored : new RequestReadGuard();
}
