import { hashKey, type QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { createMessagesApi } from "../api/messages-api";

type Tail = Awaited<
  ReturnType<ReturnType<typeof createMessagesApi>["history"]>
>;
type HistoryApi = Pick<ReturnType<typeof createMessagesApi>, "history">;
type Flight = { promise: Promise<Tail>; users: number; settled: boolean };
const flights = new WeakMap<QueryClient, Map<string, Flight>>();

function joinTail(
  flight: Flight,
  signal: AbortSignal | undefined,
  abandon: () => void,
) {
  return new Promise<Tail>((resolve, reject) => {
    flight.users++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      signal?.removeEventListener("abort", abort);
      flight.users--;
      if (!flight.users && !flight.settled) abandon();
    };
    const abort = () => {
      release();
      reject(new AppError("session"));
    };
    flight.promise.then(
      (page) => {
        release();
        resolve(page);
      },
      (error) => {
        release();
        reject(error);
      },
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

// Share simultaneous reads, but cancel transport once its last consumer leaves.
export function readMessageTail(
  cache: QueryClient,
  base: readonly unknown[],
  api: HistoryApi,
  id: string,
  signal?: AbortSignal,
): Promise<Tail> {
  if (signal?.aborted) return Promise.reject(new AppError("session"));
  let pending = flights.get(cache);
  if (!pending) {
    pending = new Map();
    flights.set(cache, pending);
  }
  const pool = pending,
    queryKey = [...base, "message-tail", id],
    signature = hashKey(queryKey);
  let flight = pool.get(signature);
  if (!flight) {
    let transport: AbortSignal | undefined;
    const promise = cache
      .fetchQuery({
        queryKey,
        staleTime: 0,
        gcTime: 0,
        retry: false,
        queryFn: ({ signal: sharedSignal }) => {
          transport = sharedSignal;
          return api.history(id, { signal: sharedSignal });
        },
      })
      .then((page) => {
        // Query cancellation can revert to cached data; it must not confirm a read.
        if (transport?.aborted) throw new AppError("session");
        return page;
      });
    const created: Flight = { promise, users: 0, settled: false };
    flight = created;
    pool.set(signature, created);
    const finish = () => {
      created.settled = true;
      if (pool.get(signature) === created) pool.delete(signature);
    };
    void promise.then(finish, finish);
  }
  const joined = flight;
  return joinTail(joined, signal, () => {
    if (pool.get(signature) === joined) pool.delete(signature);
    void cache.cancelQueries({ queryKey, exact: true }, { revert: false });
  });
}

export function cancelMessageTail(
  cache: QueryClient,
  base: readonly unknown[],
  id?: string,
) {
  return cache.cancelQueries(
    { queryKey: [...base, "message-tail", ...(id ? [id] : [])] },
    { revert: false },
  );
}

export function shareMessageTail<T extends HistoryApi>(
  cache: QueryClient,
  base: readonly unknown[],
  api: T,
) {
  return {
    ...api,
    history: (
      id: string,
      options: Parameters<HistoryApi["history"]>[1] = {},
    ) => {
      if (
        options.cursor ||
        options.afterSequence ||
        options.limit !== undefined
      )
        return api.history(id, options);
      return readMessageTail(cache, base, api, id, options.signal);
    },
  };
}
