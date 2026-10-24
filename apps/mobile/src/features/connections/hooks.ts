import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import {
  CommandIntent,
  isConnectionPolicyUnavailable,
  isRejectedCommand,
} from "@/lib/http/command-intent";
import { connectionReadAccess } from "@/lib/http/read-access";
import { useConnections } from "./runtime";
import {
  refreshConnectionReads,
  invalidateConnectionReads,
  type ConnectionReadTarget,
} from "./read-refresh";

type ReadOptions = {
  refreshOnFocus?: "always" | "stale";
  cancelOnDisable?: boolean;
};

function useCancelDisabledRead(
  key: readonly unknown[],
  valid: boolean,
  cancelOnDisable = false,
) {
  const cache = useQueryClient();
  useEffect(() => {
    if (cancelOnDisable && !valid)
      void cache.cancelQueries({
        queryKey: key,
        exact: true,
        type: "inactive",
      });
  }, [cache, key, valid, cancelOnDisable]);
}

function useReadRefresh(
  key: readonly unknown[],
  enabled: boolean,
  staleOnly: boolean,
) {
  const cache = useQueryClient();
  useConnectionRefresh(
    useCallback(
      () => refreshConnectionReads(cache, key, staleOnly),
      [cache, key, staleOnly],
    ),
    enabled,
  );
}
function logCommandFailure(error_: unknown) {
  if (!__DEV__) return;
  const failure = error_ instanceof AppError ? error_ : undefined;
  console.warn("[connections] command failed", {
    kind: failure?.kind ?? "unexpected",
    status: failure?.status,
    code: failure?.code,
  });
}

export function useConnectionRefresh(refresh: () => unknown, enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      refresh();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => listener.remove();
    }, [enabled, refresh]),
  );
}
export function useConnectionQuery<T>(
  key: readonly unknown[],
  read: (signal: AbortSignal) => Promise<T>,
  valid = true,
  options: ReadOptions = {},
) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const signature = JSON.stringify(key);
  const queryKey = useMemo(
    () => [...runtime.key, ...(JSON.parse(signature) as unknown[])],
    [runtime.key, signature],
  );
  const access = useMemo(
    () => connectionReadAccess(cache, queryKey),
    [cache, queryKey],
  );
  const query = useQuery({
    queryKey,
    meta: { connectionReadAccess: access },
    enabled: runtime.enabled && valid,
    queryFn: ({ signal }) => access.read(() => read(signal), runtime.isCurrent),
    retry: false,
  });
  useCancelDisabledRead(queryKey, valid, options.cancelOnDisable);
  useReadRefresh(
    queryKey,
    runtime.enabled && valid,
    options.refreshOnFocus === "stale",
  );
  return {
    ...query,
    data: access.denied ? undefined : query.data,
    denied: access.denied,
  };
}
export function useConnectionList<T>(
  key: readonly unknown[],
  read: (
    cursor?: string,
    signal?: AbortSignal,
  ) => Promise<{ items: T[]; nextCursor: string | null }>,
  valid = true,
  options: ReadOptions = {},
) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const signature = JSON.stringify(key);
  const queryKey = useMemo(
    () => [...runtime.key, ...(JSON.parse(signature) as unknown[])],
    [runtime.key, signature],
  );
  const access = useMemo(
    () => connectionReadAccess(cache, queryKey),
    [cache, queryKey],
  );
  const query = useInfiniteQuery({
    queryKey,
    meta: { connectionReadAccess: access },
    enabled: runtime.enabled && valid,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      access.read(() => read(pageParam, signal), runtime.isCurrent),
    getNextPageParam: (page, _pages, _lastParam, parameters) => {
      if (page.nextCursor && parameters.includes(page.nextCursor))
        throw new AppError("protocol");
      return page.nextCursor ?? undefined;
    },
    retry: false,
  });
  useCancelDisabledRead(queryKey, valid, options.cancelOnDisable);
  useReadRefresh(
    queryKey,
    runtime.enabled && valid,
    options.refreshOnFocus === "stale",
  );
  const items = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [(item as { id: string }).id, item]) ?? [],
    ).values(),
  ];
  return {
    ...query,
    data: access.denied ? undefined : query.data,
    items: access.denied ? [] : items,
    denied: access.denied,
  };
}

// Keep the identity and immutable intent on uncertain failure, including manual retry.
export function useConnectionCommand<TResult = unknown>(
  affectedKeys: readonly ConnectionReadTarget[] = [[]],
) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const intent = useRef(new CommandIntent());
  const invalidate = () =>
    invalidateConnectionReads(cache, runtime.key, affectedKeys);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const recovery = useRef<
    | {
        fingerprint: string;
        send: (identity: string) => Promise<TResult>;
      }
    | undefined
  >(undefined);
  const [uncertain, setUncertain] = useState(false);
  const [originalError, setOriginalError] = useState<unknown>();
  const clearRecovery = () => {
    recovery.current = undefined;
    setUncertain(false);
    setOriginalError(undefined);
  };
  const retainRecovery = (
    error_: unknown,
    fingerprint: string,
    send: (identity: string) => Promise<TResult>,
  ) => {
    if (!recovery.current) {
      recovery.current = { fingerprint, send };
      setOriginalError(error_);
    }
    setUncertain(true);
  };
  const failed = (
    error_: unknown,
    fingerprint: string,
    send: (identity: string) => Promise<TResult>,
  ) => {
    if (!runtime.isCurrent()) return;
    setError(error_);
    logCommandFailure(error_);
    // Completed idempotency records bypass policy checks; this rejection proves
    // that the command did not commit, even during an exact-key replay.
    const rejected =
      isConnectionPolicyUnavailable(error_) ||
      (!recovery.current && isRejectedCommand(error_));
    if (rejected) {
      intent.current.failed(error_);
      clearRecovery();
    } else {
      retainRecovery(error_, fingerprint, send);
    }
    if (
      error_ instanceof AppError &&
      error_.kind === "http" &&
      error_.status === 409
    )
      void invalidate();
  };
  useEffect(() => {
    intent.current.clear();
    busy.current = false;
    setPending(false);
    setError(undefined);
    clearRecovery();
  }, [runtime]);
  async function run<T extends TResult>(
    fingerprint: string,
    send: (identity: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (busy.current || !runtime.isCurrent()) return;
    let identity: string;
    try {
      identity = intent.current.begin(fingerprint, randomUUID);
    } catch (error_) {
      setError(error_);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await send(identity);
      runtime.assertCurrent();
      intent.current.clear();
      clearRecovery();
      void invalidate();
      return result;
    } catch (error_) {
      failed(error_, fingerprint, send);
    } finally {
      if (runtime.isCurrent()) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  const retry = () => {
    const previous = recovery.current;
    if (!previous) return Promise.resolve(undefined);
    return run(previous.fingerprint, previous.send);
  };
  return { run, retry, pending, error, uncertain, originalError };
}
