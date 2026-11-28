"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

export type CollapsibleNavGroupConfig = Readonly<{
  id: string;
  defaultOpen: boolean;
}>;

export type CollapsibleNavState = Readonly<Record<string, boolean>>;

type DismissedActive = Readonly<{
  groupId: string;
  pathname: string;
}> | null;

const listenersByKey = new Map<string, Set<() => void>>();
const memoryStore = new Map<string, string>();

function notifyListeners(storageKey: string) {
  const listeners = listenersByKey.get(storageKey);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function readRawStorage(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) return stored;
  } catch {
    // Fall back to in-memory store when storage is unavailable.
  }
  return memoryStore.get(storageKey) ?? null;
}

function writeRawStorage(storageKey: string, value: string) {
  memoryStore.set(storageKey, value);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // In-memory store preserves the toggle state for the current session.
    }
  }
  notifyListeners(storageKey);
}

export function parseStoredNavState(raw: string | null): CollapsibleNavState {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function resolveNavGroupExpanded({
  groupId,
  defaultOpen,
  persisted,
  activeGroupId,
  pathname,
  dismissedActive,
}: Readonly<{
  groupId: string;
  defaultOpen: boolean;
  persisted: CollapsibleNavState;
  activeGroupId: string | undefined;
  pathname: string;
  dismissedActive: DismissedActive;
}>): boolean {
  const isActiveGroup = activeGroupId === groupId;
  const dismissedOnCurrentPath =
    dismissedActive !== null &&
    dismissedActive.groupId === groupId &&
    dismissedActive.pathname === pathname;

  if (isActiveGroup && !dismissedOnCurrentPath) {
    return true;
  }
  const saved = persisted[groupId];
  return typeof saved === "boolean" ? saved : defaultOpen;
}

function subscribeStorage(storageKey: string, callback: () => void) {
  let listeners = listenersByKey.get(storageKey);
  if (!listeners) {
    listeners = new Set();
    listenersByKey.set(storageKey, listeners);
  }
  listeners.add(callback);

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === null || event.key === storageKey) {
      callback();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageEvent);
  }

  return () => {
    listeners?.delete(callback);
    if (listeners && listeners.size === 0) {
      listenersByKey.delete(storageKey);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

/**
 * Hydration-safe collapsible sidebar group state:
 * - Persists manual expand/collapse toggles in localStorage per portal.
 * - Automatically expands the group containing the active route on navigation,
 *   while still respecting manual collapse on the current page.
 */
export function useCollapsibleNavGroups({
  storageKey,
  groups,
  activeGroupId,
  pathname,
}: Readonly<{
  storageKey: string;
  groups: readonly CollapsibleNavGroupConfig[];
  activeGroupId: string | undefined;
  pathname: string;
}>) {
  const [dismissedActive, setDismissedActive] = useState<DismissedActive>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeStorage(storageKey, onStoreChange),
    [storageKey],
  );
  const getSnapshot = useCallback(
    () => readRawStorage(storageKey),
    [storageKey],
  );
  const rawStored = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const persisted = useMemo(() => parseStoredNavState(rawStored), [rawStored]);
  const defaultsById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const group of groups) {
      map.set(group.id, group.defaultOpen);
    }
    return map;
  }, [groups]);

  const isExpanded = useCallback(
    (groupId: string) =>
      resolveNavGroupExpanded({
        groupId,
        defaultOpen: defaultsById.get(groupId) ?? true,
        persisted,
        activeGroupId,
        pathname,
        dismissedActive,
      }),
    [defaultsById, persisted, activeGroupId, pathname, dismissedActive],
  );

  const toggle = useCallback(
    (groupId: string) => {
      const currentPersisted = parseStoredNavState(readRawStorage(storageKey));
      const defaultOpen =
        groups.find((group) => group.id === groupId)?.defaultOpen ?? true;
      const currentlyOpen = resolveNavGroupExpanded({
        groupId,
        defaultOpen,
        persisted: currentPersisted,
        activeGroupId,
        pathname,
        dismissedActive,
      });
      const nextOpen = !currentlyOpen;
      const nextPersisted = { ...currentPersisted, [groupId]: nextOpen };
      writeRawStorage(storageKey, JSON.stringify(nextPersisted));

      if (activeGroupId === groupId) {
        setDismissedActive(nextOpen ? null : { groupId, pathname });
      }
    },
    [storageKey, groups, activeGroupId, pathname, dismissedActive],
  );

  return { isExpanded, toggle };
}
