"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { StaffApiError, isSessionFailure } from "@/lib/staff/client";
import { appendCursor, mergePage } from "@/lib/staff/pagination";
import type { ApiEnvelope, Pagination } from "@/lib/staff/types";
import { useStaffSession } from "./session";
import { splitPages } from "@/components/pagination/use-list-pages";

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
export function useStaffResource<T>(
  path: string,
  options?: { retainOnReload?: boolean; enabled?: boolean },
) {
  const retainOnReload = options?.retainOnReload ?? false;
  const enabled = options?.enabled ?? true;
  const { expire, api } = useStaffSession();
  const [state, setState] = useState<{
    path: string;
    result?: ApiEnvelope<T>;
    error?: string;
    loading: boolean;
  }>({ path, loading: enabled });
  const current = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    if (!enabled) return Promise.resolve();
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
          loading: false,
          ...(retainOnReload && previous.path === path && isTemporaryFailure(e)
            ? { result: previous.result }
            : {}),
          error: e instanceof Error ? e.message : "Không thể tải dữ liệu.",
        }));
      });
  }, [path, expire, api, retainOnReload, enabled]);
  useEffect(() => {
    if (!enabled) {
      current.current?.abort();
      return;
    }
    void load();
    return () => current.current?.abort();
  }, [load, enabled]);
  const fresh = enabled && state.path === path;
  return {
    data: fresh ? state.result?.data : undefined,
    pagination: fresh ? state.result?.meta?.pagination : undefined,
    error: fresh ? state.error : undefined,
    loading: enabled && (!fresh || state.loading),
    reload: () => {
      if (!enabled) return Promise.resolve();
      setState((previous) => ({
        path,
        loading: true,
        ...(retainOnReload && previous.path === path
          ? { result: previous.result }
          : {}),
      }));
      return load();
    },
  };
}
export function useStaffList<T extends { id?: string; userId?: string }>(
  path: string,
  options?: { enabled?: boolean },
) {
  const { expire, api, actor, portal } = useStaffSession();
  const scope = `${portal}:${actor?.userId ?? ""}:${path}`;
  const enabled = !!actor && (options?.enabled ?? true);
  const [state, setState] = useState<{
    path: string;
    items: T[];
    chunks: T[][];
    page?: Pagination;
    loading: boolean;
    error?: string;
  }>({ path: scope, items: [], chunks: [], loading: enabled });
  const pending = useRef(false);
  const current = useRef<AbortController | null>(null);
  const cursors = useRef(new Set<string>());
  const activeScope = useRef<string | null>(null);
  const load = useCallback(
    (cursor?: string) => {
      if (!enabled || activeScope.current !== scope) return;
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
          setState((s) => {
            function resultChunks() {
              if (cursor) {
                return [...s.chunks, result.data];
              }
              if (result.meta?.pagination) {
                return [result.data];
              }
              return splitPages(result.data);
            }
            return {
              path: scope,
              items: cursor ? mergePage(s.items, result.data) : result.data,
              chunks: resultChunks(),
              page: result.meta?.pagination,
              loading: false,
            };
          });
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          if (isSessionFailure(e)) expire();
          setState((s) => {
            const keepItems = s.path === scope && isTemporaryFailure(e);
            return {
              path: scope,
              items: keepItems ? s.items : [],
              chunks: keepItems ? s.chunks : [],
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
    [path, expire, api, scope, enabled],
  );
  useEffect(() => {
    if (!enabled) {
      current.current?.abort();
      return;
    }
    activeScope.current = scope;
    void load();
    return () => {
      if (activeScope.current === scope) activeScope.current = null;
      current.current?.abort();
    };
  }, [load, scope, enabled]);
  const fresh = enabled && state.path === scope;
  return {
    scope,
    chunks: fresh ? state.chunks : [],
    items: fresh ? state.items : [],
    page: fresh ? state.page : undefined,
    loading: enabled && (!fresh || state.loading),
    error: fresh ? state.error : undefined,
    reload: () => {
      if (!enabled || activeScope.current !== scope) return;
      setState((s) => ({
        path: scope,
        items: s.path === scope ? s.items : [],
        chunks: s.path === scope ? s.chunks : [],
        page: s.path === scope ? s.page : undefined,
        loading: true,
      }));
      return load();
    },
    more: () => {
      if (!enabled || activeScope.current !== scope) return;
      if (pending.current || !fresh || !state.page?.nextCursor) return;
      setState((s) => ({ ...s, loading: true }));
      return load(state.page.nextCursor);
    },
  };
}
