import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { AppError } from "./errors";

export class ReadAccess {
  denied = false;
  private ticket = 0;
  async read<T>(load: () => Promise<T>, isCurrent: () => boolean) {
    const ticket = ++this.ticket;
    if (!isCurrent()) throw new AppError("session");
    try {
      const result = await load();
      if (!isCurrent()) throw new AppError("session");
      if (ticket === this.ticket) this.denied = false;
      return result;
    } catch (error) {
      if (
        ticket === this.ticket &&
        isCurrent() &&
        error instanceof AppError &&
        [403, 404].includes(error.status)
      )
        this.denied = true;
      throw error;
    }
  }
}
export function connectionReadAccess(cache: QueryClient, key: QueryKey) {
  const previous = cache.getQueryCache().find({ queryKey: key, exact: true })
    ?.meta?.connectionReadAccess;
  return previous instanceof ReadAccess ? previous : new ReadAccess();
}
