"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { StaffApiError } from "@/lib/staff/client";
import type { ApiEnvelope, Pagination } from "@/lib/staff/types";
import { useStaffSession } from "./session";
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
        if (
          e instanceof StaffApiError &&
          (e.status === 401 ||
            e.code === "STAFF_PORTAL_ACCESS_REQUIRED" ||
            e.code === "ADMIN_PORTAL_ACCESS_REQUIRED")
        )
          expire();
        setState({
          path,
          loading: false,
          error: e instanceof Error ? e.message : "Không thể tải dữ liệu.",
        });
      });
  }, [path, expire, api]);
  useEffect(() => {
    void load();
    return () => current.current?.abort();
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
export function useStaffList<T>(path: string) {
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
  const load = useCallback(
    (cursor?: string) => {
      if (cursor && pending.current) return;
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      pending.current = true;
      return api<T[]>(
        path +
          (cursor
            ? `${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
            : ""),
        { signal: controller.signal },
      )
        .then((result) => {
          if (!Array.isArray(result.data))
            throw new StaffApiError(502, "API_RESPONSE_INVALID");
          if (!controller.signal.aborted)
            setState((s) => ({
              path,
              items: cursor
                ? [...s.items, ...result.data].filter(
                    (item, index, all) =>
                      all.findIndex(
                        (other) =>
                          ((other as { id?: string; userId?: string }).id ??
                            (other as { userId?: string }).userId) ===
                          ((item as { id?: string; userId?: string }).id ??
                            (item as { userId?: string }).userId),
                      ) === index,
                  )
                : result.data,
              page: result.meta?.pagination,
              loading: false,
            }));
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          if (
            e instanceof StaffApiError &&
            (e.status === 401 ||
              e.code === "STAFF_PORTAL_ACCESS_REQUIRED" ||
              e.code === "ADMIN_PORTAL_ACCESS_REQUIRED")
          )
            expire();
          setState((s) => ({
            path,
            items: cursor && s.path === path ? s.items : [],
            page: cursor && s.path === path ? s.page : undefined,
            loading: false,
            error: e instanceof Error ? e.message : "Không thể tải hàng đợi.",
          }));
        })
        .finally(() => {
          if (current.current === controller) pending.current = false;
        });
    },
    [path, expire, api],
  );
  useEffect(() => {
    void load();
    return () => current.current?.abort();
  }, [load]);
  const fresh = state.path === path;
  return {
    items: fresh ? state.items : [],
    page: fresh ? state.page : undefined,
    loading: !fresh || state.loading,
    error: fresh ? state.error : undefined,
    reload: () => {
      setState({ path, items: [], loading: true });
      return load();
    },
    more: () => {
      if (pending.current || !state.page?.nextCursor) return;
      setState((s) => ({ ...s, loading: true }));
      return load(state.page.nextCursor);
    },
  };
}
