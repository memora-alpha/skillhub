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
  useConnectionRefresh(query.refetch, runtime.enabled && valid);
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
  useConnectionRefresh(query.refetch, runtime.enabled && valid);
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
export function useConnectionCommand<TResult = unknown>() {
  const runtime = useConnections();
  const cache = useQueryClient();
  const intent = useRef(new CommandIntent());
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
  useEffect(() => {
    intent.current.clear();
    busy.current = false;
    setPending(false);
    setError(undefined);
    recovery.current = undefined;
    setUncertain(false);
    setOriginalError(undefined);
  }, [runtime]);
  async function run<T extends TResult>(
    fingerprint: string,
    send: (identity: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (busy.current || !runtime.isCurrent()) return;
    let identity: string;
    try {
      identity = intent.current.begin(fingerprint, randomUUID);
    } catch (caught) {
      setError(caught);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await send(identity);
      runtime.assertCurrent();
      intent.current.clear();
      recovery.current = undefined;
      setUncertain(false);
      setOriginalError(undefined);
      void cache.invalidateQueries({ queryKey: runtime.key });
      return result;
    } catch (caught) {
      if (runtime.isCurrent()) {
        setError(caught);
        if (__DEV__)
          console.warn("[connections] command failed", {
            kind: caught instanceof AppError ? caught.kind : "unexpected",
            status: caught instanceof AppError ? caught.status : undefined,
            code: caught instanceof AppError ? caught.code : undefined,
          });
        // A policy failure occurs only for an uncommitted command, including on
        // replay: completed idempotency records bypass proposal normalization.
        if (
          isConnectionPolicyUnavailable(caught) ||
          (!recovery.current && isRejectedCommand(caught))
        ) {
          intent.current.failed(caught);
          recovery.current = undefined;
          setUncertain(false);
          setOriginalError(undefined);
        } else {
          if (!recovery.current) {
            recovery.current = { fingerprint, send };
            setOriginalError(caught);
          }
          setUncertain(true);
        }
        if (
          caught instanceof AppError &&
          caught.kind === "http" &&
          caught.status < 500
        ) {
          if (caught.status === 409)
            void cache.invalidateQueries({ queryKey: runtime.key });
        }
      }
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
