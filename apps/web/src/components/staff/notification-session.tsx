"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  isSessionFailure,
  refreshStaffSession,
  staffEvents,
  StaffApiError,
} from "@/lib/staff/client";
import { createNotificationInbox } from "@/lib/staff/notification-inbox";
import {
  consumeNotificationEvents,
  createNotificationHydrator,
} from "@/lib/staff/notification-events";
import { useStaffSession } from "./session";

type LiveStatus = "connecting" | "connected" | "paused" | "unavailable";
type ContextValue = {
  inbox: ReturnType<typeof createNotificationInbox>;
  live: LiveStatus;
  retry: () => void;
};
const Context = createContext<ContextValue | null>(null);
export function NotificationsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { actor, portal } = useStaffSession();
  if (!actor) return children;
  return (
    <NotificationSession key={`${portal}:${actor.userId}`}>
      {children}
    </NotificationSession>
  );
}
function NotificationSession({ children }: Readonly<{ children: ReactNode }>) {
  const { api, expire, portal } = useStaffSession();
  const [inbox] = useState(() => createNotificationInbox(api, expire));
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    inbox.activate();
    return () => inbox.dispose();
  }, [inbox]);
  useEffect(() => {
    let disposed = false,
      failures = 0;
    let abort: AbortController | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const hydration = createNotificationHydrator({
      reload: () => inbox.reload(),
      renew: () => refreshStaffSession(portal),
      ready: () => {
        if (!disposed) {
          failures = 0;
          setLive("connected");
        }
      },
    });
    const connect = async () => {
      if (disposed || document.visibilityState === "hidden") return;
      const control = new AbortController();
      abort = control;
      setLive("connecting");
      try {
        const body = await staffEvents(
          portal,
          control.signal,
          hydration.cursor,
        );
        await consumeNotificationEvents(body, hydration, control.signal);
        if (!control.signal.aborted)
          throw new StaffApiError(0, "STREAM_CLOSED");
      } catch (error) {
        if (disposed || control.signal.aborted) return;
        if (isSessionFailure(error)) {
          expire();
          return;
        }
        if (
          error instanceof StaffApiError &&
          (error.status === 409 || (error.status === 400 && hydration.cursor))
        )
          hydration.reset();
        setLive("unavailable");
        failures++;
        if (
          failures <= 6 &&
          !(error instanceof StaffApiError && error.status === 403)
        )
          timer = setTimeout(
            () => {
              void connect();
            },
            Math.min(30000, 3000 * 2 ** (failures - 1)) + Math.random() * 500,
          );
      } finally {
        control.abort();
      }
    };
    const visibility = () => {
      abort?.abort();
      clearTimeout(timer);
      if (document.visibilityState === "hidden") setLive("paused");
      else {
        failures = 0;
        void inbox.reload().catch(() => {});
        void connect();
      }
    };
    // REST remains available if the stream is unavailable; ready hydrates again
    // after its server anchor to cover the initial snapshot/live race.
    void inbox.reload().catch(() => {});
    void connect();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      abort?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [inbox, portal, expire, attempt]);
  return (
    <Context.Provider
      value={{ inbox, live, retry: () => setAttempt((value) => value + 1) }}
    >
      {children}
    </Context.Provider>
  );
}
export function useNotificationInbox() {
  const context = useContext(Context);
  if (!context) throw new Error("NotificationsProvider missing");
  const state = useSyncExternalStore(
    context.inbox.subscribe,
    context.inbox.snapshot,
    context.inbox.snapshot,
  );
  return { ...context, ...state };
}
