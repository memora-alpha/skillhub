import { StaffApiError, isSessionFailure, type PortalApi } from "./client";
import { appendCursor } from "./pagination";
import type { InboxNotification, Pagination } from "./types";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validNotificationId(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
function notification(value: unknown): value is InboxNotification {
  if (!value || typeof value !== "object") return false;
  const item = value as InboxNotification;
  return (
    validNotificationId(item.id) &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.type === "string" &&
    typeof item.createdAt === "string" &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    (item.readAt === null ||
      (typeof item.readAt === "string" &&
        Number.isFinite(Date.parse(item.readAt))))
  );
}
function validatePage(
  items: unknown,
  page?: Pagination,
): asserts items is InboxNotification[] {
  if (
    !Array.isArray(items) ||
    !items.every(notification) ||
    !page ||
    !Number.isInteger(page.limit) ||
    page.limit < 1 ||
    page.limit > 100 ||
    typeof page.hasMore !== "boolean" ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === "string" && page.nextCursor.length > 0)
    ) ||
    page.hasMore !== (page.nextCursor !== null)
  )
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
}
export type InboxState = {
  items: InboxNotification[];
  unreadCount?: number;
  page?: Pagination;
  loading: boolean;
  error?: string;
  pendingId?: string;
  actionError?: string;
};
export function createNotificationInbox(api: PortalApi, expire: () => void) {
  let state: InboxState = { items: [], loading: true };
  const listeners = new Set<() => void>();
  let current: AbortController | undefined,
    mutation: AbortController | undefined;
  let disposed = false,
    pages = 1;
  let visited = new Set<string>();
  let flight: Promise<void> | undefined, queued: Promise<void> | undefined;
  const update = (next: Partial<InboxState>) => {
    if (disposed) return;
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const failed = (error: unknown, action = false) => {
    if (isSessionFailure(error)) expire();
    const denied =
      error instanceof StaffApiError && [401, 403, 404].includes(error.status);
    update({
      ...(denied ? { items: [], page: undefined, unreadCount: undefined } : {}),
      ...(action
        ? {
            actionError:
              error instanceof Error
                ? error.message
                : "Không thể cập nhật thông báo.",
          }
        : {
            error:
              error instanceof Error
                ? error.message
                : "Không thể tải thông báo.",
          }),
    });
  };
  async function readPage(
    cursor: string | undefined,
    seen: Set<string>,
    signal: AbortSignal,
  ) {
    if (cursor && seen.has(cursor))
      throw new StaffApiError(502, "API_RESPONSE_INVALID");
    if (cursor) seen.add(cursor);
    const result = await api<unknown>(
      appendCursor("notifications?limit=20", cursor),
      { signal },
    );
    if (signal.aborted || disposed) return;
    validatePage(result.data, result.meta?.pagination);
    const page = result.meta!.pagination!;
    if (
      page.nextCursor &&
      (page.nextCursor === cursor || seen.has(page.nextCursor))
    )
      throw new StaffApiError(502, "API_RESPONSE_INVALID");
    return { items: result.data, page };
  }
  async function readPages(more: boolean, signal: AbortSignal) {
    const count = more ? 1 : pages;
    let cursor = more ? (state.page?.nextCursor ?? undefined) : undefined;
    let items = more ? state.items : [];
    let page: Pagination | undefined,
      loaded = 0;
    const seen = new Set(more ? visited : []);
    // Reload all visible pages with fresh cursors to preserve older items.
    for (let index = 0; index < count; index++) {
      const result = await readPage(cursor, seen, signal);
      if (!result) return;
      page = result.page;
      items = [
        ...new Map(
          [...items, ...result.items].map((item) => [item.id, item]),
        ).values(),
      ];
      loaded++;
      cursor = page.nextCursor ?? undefined;
      if (!cursor) break;
    }
    return { items, page, loaded, seen };
  }
  async function countUnread(signal: AbortSignal) {
    let cursor: string | undefined;
    let count = 0;
    const seen = new Set<string>();
    const ids = new Set<string>();
    do {
      const result = await readPage(cursor, seen, signal);
      if (!result) return;
      for (const item of result.items) {
        if (!ids.has(item.id) && !item.readAt) count++;
        ids.add(item.id);
      }
      if (count > 99) return 100;
      cursor = result.page.nextCursor ?? undefined;
    } while (cursor);
    return count;
  }
  async function load(more = false) {
    if (disposed || (more && (state.loading || !state.page?.nextCursor)))
      return;
    current?.abort();
    const control = new AbortController();
    current = control;
    update({ loading: true, error: undefined });
    try {
      const [result, unreadCount] = await Promise.all([
        readPages(more, control.signal),
        countUnread(control.signal),
      ]);
      if (!result) return;
      pages = more ? pages + result.loaded : result.loaded;
      visited = result.seen;
      update({
        items: result.items,
        page: result.page,
        unreadCount,
        loading: false,
      });
    } catch (error) {
      if (control.signal.aborted || disposed) return;
      failed(error);
      update({ loading: false });
      throw error;
    }
  }
  function run(more = false): Promise<void> {
    if (disposed) return Promise.resolve();
    if (flight) {
      if (more) return flight;
      // An event may commit after the current snapshot began. Queue a new
      // snapshot rather than acknowledging it with the older in-flight read.
      queued ??= flight
        .catch(() => {})
        .then(() => {
          queued = undefined;
          return run();
        });
      return queued;
    }
    const task = load(more);
    flight = task;
    const clear = () => {
      if (flight === task) flight = undefined;
    };
    void task.then(clear, clear);
    return task;
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => state,
    activate() {
      disposed = false;
    },
    reload: () => run(),
    more: () => run(true),
    async markRead(id: string) {
      if (disposed || mutation) return false;
      if (
        !validNotificationId(id) ||
        !state.items.some((item) => item.id === id)
      )
        return false;
      if (state.items.find((item) => item.id === id)?.readAt) return true;
      const control = new AbortController();
      mutation = control;
      update({ pendingId: id, actionError: undefined });
      try {
        await api<null>(`notifications/${id}/read`, {
          method: "PATCH",
          body: {},
          signal: control.signal,
        });
        if (disposed || control.signal.aborted) return false;
        update({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          ),
        });
        // Read is committed. A refresh failure must not report the write as failed.
        void run().catch(() => {});
        return true;
      } catch (error) {
        if (!disposed && !control.signal.aborted) failed(error, true);
        return false;
      } finally {
        if (mutation === control) mutation = undefined;
        update({ pendingId: undefined });
      }
    },
    dispose() {
      disposed = true;
      current?.abort();
      mutation?.abort();
    },
  };
}
