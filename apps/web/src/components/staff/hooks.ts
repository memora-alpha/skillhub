"use client";
import {
  isConnectionFailure,
  onConnectionRestored,
} from "@/lib/network/connection-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { StaffApiError, isSessionFailure } from "@/lib/staff/client";
import { appendCursor, mergePage } from "@/lib/staff/pagination";
import type { ApiEnvelope, Pagination } from "@/lib/staff/types";
import { useStaffSession } from "./session";

function isTemporaryFailure(error: unknown) {
  return (
    error instanceof StaffApiError &&
    (error.status === 0 ||
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500)
  );
}
export function useStaffCommand() {
  const { api } = useStaffSession();
  const attempt = useRef<{ digest: string; key: string } | null>(null);
  return async (
    path: string,
    method: string,
    body: Record<string, unknown>,
  ) => {
    const digest = JSON.stringify({ path, method, body });
    if (attempt.current?.digest !== digest)
      attempt.current = { digest, key: crypto.randomUUID() };
    const result = await api(path, { method, body, key: attempt.current.key });
    attempt.current = null;
    return result;
  };
}
export function useStaffResource<T>(path: string) {
  const { expire, api } = useStaffSession();
  const [state, setState] = useState<{
    path: string;
    result?: ApiEnvelope<T>;
    error?: string;
    loading: boolean;
  }>({ path, loading: true });
  const current = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    return api<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ path, result, loading: false });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (isSessionFailure(e)) expire();
        setState((previous) => ({
          path,
          result:
            previous.path === path && isConnectionFailure(e)
              ? previous.result
              : undefined,
          loading: false,
          error: e instanceof Error ? e.message : "Không thể tải dữ liệu.",
        }));
      });
  }, [path, expire, api]);
  useEffect(() => {
    void load();
    const unsubscribe = onConnectionRestored(() => {
      void load();
    });
    return () => {
      unsubscribe();
      current.current?.abort();
    };
  }, [load]);
  const fresh = state.path === path;
  return {
    data: fresh ? state.result?.data : undefined,
    pagination: fresh ? state.result?.meta?.pagination : undefined,
    error: fresh ? state.error : undefined,
    loading: !fresh || state.loading,
    reload: () => {
      setState({ path, loading: true });
      return load();
    },
  };
}
export function useStaffList<T extends { id?: string; userId?: string }>(
  path: string,
) {
  const { expire, api } = useStaffSession();
  const [state, setState] = useState<{
    path: string;
    items: T[];
    page?: Pagination;
    loading: boolean;
    error?: string;
  }>({ path, items: [], loading: true });
  const pending = useRef(false);
  const current = useRef<AbortController | null>(null);
  const cursors = useRef(new Set<string>());
  const load = useCallback(
    (cursor?: string) => {
      if (cursor && pending.current) return;
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      pending.current = true;
      return api<T[]>(appendCursor(path, cursor), { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          const next = result.meta?.pagination?.nextCursor;
          if (
            !Array.isArray(result.data) ||
            (cursor && next && (next === cursor || cursors.current.has(next)))
          )
            throw new StaffApiError(502, "API_RESPONSE_INVALID");
          if (cursor) cursors.current.add(cursor);
          else cursors.current.clear();
          setState((s) => ({
            path,
            items: cursor ? mergePage(s.items, result.data) : result.data,
            page: result.meta?.pagination,
            loading: false,
          }));
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          if (isSessionFailure(e)) expire();
          setState((s) => {
            const keepItems = s.path === path && isTemporaryFailure(e);
            return {
              path,
              items: keepItems ? s.items : [],
              page: keepItems ? s.page : undefined,
              loading: false,
              error: e instanceof Error ? e.message : "Không thể tải hàng đợi.",
            };
          });
        })
        .finally(() => {
          if (current.current === controller) pending.current = false;
        });
    },
    [path, expire, api],
  );
  useEffect(() => {
    void load();
    const unsubscribe = onConnectionRestored(() => {
      void load();
    });
    return () => {
      unsubscribe();
      current.current?.abort();
    };
  }, [load]);
  const fresh = state.path === path;
  return {
    items: fresh ? state.items : [],
    page: fresh ? state.page : undefined,
    loading: !fresh || state.loading,
    error: fresh ? state.error : undefined,
    reload: () => {
      setState((s) => ({
        path,
        items: s.path === path ? s.items : [],
        page: s.path === path ? s.page : undefined,
        loading: true,
      }));
      return load();
    },
    more: () => {
      if (pending.current || !fresh || !state.page?.nextCursor) return;
      setState((s) => ({ ...s, loading: true }));
      return load(state.page.nextCursor);
    },
  };
}
