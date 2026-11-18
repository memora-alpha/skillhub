"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffApiError, isSessionFailure } from "@/lib/staff/client";
import { createCursorPages, type CursorPage } from "@/lib/staff/cursor-pages";
import { useStaffSession } from "./session";

export function useStaffPagedList<T extends { id: string }>(path: string) {
  const { actor, api, expire } = useStaffSession();
  const pages = useMemo(
    () =>
      createCursorPages<T>(path, (url, signal) => {
        if (!actor) throw new StaffApiError(401, "SESSION_EXPIRED");
        return api<T[]>(url, { signal });
      }),
    [path, api, actor],
  );
  const [state, setState] = useState<{
    pages: typeof pages;
    result?: CursorPage<T>;
    loading: boolean;
    error?: string;
  }>({ pages, loading: true });
  const activePages = useRef<typeof pages | null>(null);
  const current = useRef<AbortController | null>(null);
  const enabled = !!actor;
  const load = useCallback(
    async (pageNumber: number) => {
      if (!enabled || activePages.current !== pages) return;
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      setState((previous) => ({
        pages,
        result: previous.pages === pages ? previous.result : undefined,
        loading: true,
      }));
      try {
        const result = await pages.get(pageNumber, controller.signal);
        if (!controller.signal.aborted)
          setState({ pages, result, loading: false });
      } catch (cause) {
        if (controller.signal.aborted) return;
        const temporary =
          cause instanceof StaffApiError &&
          (cause.status === 0 ||
            cause.status === 408 ||
            cause.status === 429 ||
            cause.status >= 500);
        if (!temporary) pages.clear();
        if (isSessionFailure(cause)) expire();
        setState((previous) => ({
          pages,
          result:
            temporary && previous.pages === pages ? previous.result : undefined,
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : "Chưa tải được trang. Hãy thử lại.",
        }));
      }
    },
    [pages, enabled, expire],
  );
  useEffect(() => {
    activePages.current = pages;
    void load(1);
    return () => {
      if (activePages.current === pages) activePages.current = null;
      current.current?.abort();
    };
  }, [load, pages]);
  const fresh = enabled && state.pages === pages;
  const result = fresh ? state.result : undefined;
  return {
    items: result?.items ?? [],
    page: result?.page,
    pageNumber: result?.pageNumber ?? 1,
    totalPages: result?.totalPages,
    loading: enabled && (!fresh || state.loading),
    error: fresh ? state.error : undefined,
    goToPage: load,
    reload: () => {
      if (activePages.current !== pages) return;
      current.current?.abort();
      pages.clear();
      setState({ pages, loading: true });
      return load(1);
    },
  };
}
