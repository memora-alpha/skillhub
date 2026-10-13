"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { staffApi, StaffApiError, type PortalApi } from "@/lib/staff/client";
import type { Portal } from "@/lib/staff/policy";
import type { StaffIdentity } from "@/lib/staff/types";
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
};
const Context = createContext<Session | null>(null);
export function useStaffSession() {
  const context = useContext(Context);
  if (!context) throw new Error("StaffSessionProvider missing");
  return context;
}
export function StaffSessionProvider({
  children,
  portal = "staff",
}: {
  children: ReactNode;
  portal?: Portal;
}) {
  const api: PortalApi = useCallback(
    (path, options) => staffApi(path, options, portal),
    [portal],
  );
  const [actor, setActor] = useState<StaffIdentity | null>(null);
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
    api<StaffIdentity>("session", { signal: controller.signal })
      .then((result) => {
        setActor(result.data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setActor(null);
        setError(
          e instanceof StaffApiError && e.status === 401
            ? null
            : e instanceof Error
              ? e.message
              : "Không thể kiểm tra phiên làm việc.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, api]);
  async function perform(fn: () => Promise<void>) {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  async function login(email: string, password: string) {
    await perform(async () => {
      const result = await api<StaffIdentity>("session", {
        method: "POST",
        body: { email, password },
      });
      setActor(result.data);
      setError(null);
    });
  }
  async function logout() {
    await perform(async () => {
      await api<null>("session", { method: "DELETE" });
      setActor(null);
      setError(null);
    });
  }
  return (
    <Context.Provider
      value={{
        portal,
        api,
        actor,
        loading,
        error,
        busy,
        login,
        logout,
        expire,
        refresh: () => {
          setLoading(true);
          setRevision((v) => v + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
