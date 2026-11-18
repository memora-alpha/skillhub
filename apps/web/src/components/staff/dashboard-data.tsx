"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStaffResource } from "./hooks";
import { useStaffListPages } from "./use-staff-list-pages";

const RefreshContext = createContext({ revision: 0, refresh: () => {} });
export function DashboardRefreshProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [revision, setRevision] = useState(0);
  return (
    <RefreshContext.Provider
      value={{ revision, refresh: () => setRevision((value) => value + 1) }}
    >
      {children}
    </RefreshContext.Provider>
  );
}
export const useDashboardRefresh = () => useContext(RefreshContext);
function useRefreshRevision(reload: () => unknown) {
  const { revision } = useDashboardRefresh();
  const last = useRef(revision);
  const callback = useRef(reload);
  useEffect(() => {
    callback.current = reload;
  }, [reload]);
  useEffect(() => {
    if (last.current === revision) return;
    last.current = revision;
    void callback.current();
  }, [revision]);
}
export function useDashboardResource<T>(path: string) {
  const resource = useStaffResource<T>(path, { retainOnReload: true });
  useRefreshRevision(resource.reload);
  return resource;
}
export function useDashboardList<T extends { id: string }>(path: string) {
  const list = useStaffListPages<T>(path);
  useRefreshRevision(list.reload);
  return list;
}
