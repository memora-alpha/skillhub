"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { staffApi, StaffApiError, type PortalApi } from "@/lib/staff/client";
import type { Portal } from "@/lib/staff/policy";
import type { StaffIdentity } from "@/lib/staff/types";
import { createDemoApi } from "@/lib/staff/demo-api";
type Session = {
  portal: Portal;
  api: PortalApi;
  actor: StaffIdentity | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
  expire: () => void;
  demo: boolean;
  setDemo: (enabled: boolean) => void;
};
const Context = createContext<Session | null>(null);
function sessionError(error: unknown): string | null {
  if (error instanceof StaffApiError && error.status === 401) return null;
  return error instanceof Error
    ? error.message
    : "Không thể kiểm tra phiên làm việc.";
}
export function useStaffSession() {
  const context = useContext(Context);
  if (!context) throw new Error("StaffSessionProvider missing");
  return context;
}
export function StaffSessionProvider({
  children,
  portal = "staff",
}: Readonly<{
  children: ReactNode;
  portal?: Portal;
}>) {
  const [actor, setActor] = useState<StaffIdentity | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const demo =
    demoEnabled && portal === "admin" && !!actor?.roles.includes("ADMIN");
  const actorId = actor?.userId;
  const api: PortalApi = useCallback(
    (path, options) => {
      if (
        demo &&
        actorId &&
        path !== "session" &&
        !path.startsWith("session/")
      ) {
        try {
          return createDemoApi(actorId, window.localStorage)(path, options);
        } catch {
          return Promise.reject(
            new StaffApiError(400, "DEMO_STORAGE_UNAVAILABLE"),
          );
        }
      }
      return staffApi(path, options, portal);
    },
    [portal, demo, actorId],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const action = useRef(false);
  const expire = useCallback(() => {
    setActor(null);
    setError("Phiên làm việc đã hết hạn. Đăng nhập lại để tiếp tục.");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    staffApi<StaffIdentity>("session", { signal: controller.signal }, portal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setActor(result.data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setActor(null);
        setError(sessionError(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, portal]);
  const perform = useCallback(async (fn: () => Promise<void>) => {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      action.current = false;
      setBusy(false);
    }
  }, []);
  const login = useCallback(
    async (email: string, password: string) => {
      await perform(async () => {
        const result = await api<StaffIdentity>("session", {
          method: "POST",
          body: { email, password },
        });
        setActor(result.data);
        setError(null);
      });
    },
    [api, perform],
  );
  const logout = useCallback(async () => {
    await perform(async () => {
      await api<null>("session", { method: "DELETE" });
      setActor(null);
      setError(null);
      setDemoEnabled(false);
    });
  }, [api, perform]);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((v) => v + 1);
  }, []);
  const value = useMemo<Session>(
    () => ({
      portal,
      api,
      actor,
      loading,
      error,
      busy,
      login,
      logout,
      expire,
      refresh,
      demo,
      setDemo: setDemoEnabled,
    }),
    [
      portal,
      api,
      actor,
      loading,
      error,
      busy,
      login,
      logout,
      expire,
      refresh,
      demo,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
