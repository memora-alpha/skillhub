import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { fetch as streamFetch } from "expo/fetch";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/config/env";
import { AppError } from "@/lib/http/errors";
import { useConnections } from "@/features/connections";
import { createSseParser } from "../utils/sse-parser";
import {
  createChatEventHydrator,
  reloadChatEventQueries,
} from "../utils/event-hydration";

const Context = createContext<{
  connected: boolean;
  error: unknown;
  retry: () => void;
}>({ connected: false, error: undefined, retry: () => {} });
export function ChatEventsProvider({ children }: { children: ReactNode }) {
  const runtime = useConnections(),
    cache = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!runtime.enabled) return;
    let disposed = false,
      active = AppState.currentState !== "background";
    let abort: AbortController | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const hydration = createChatEventHydrator({
      assertCurrent: runtime.assertCurrent,
      renew: () => runtime.controller.renew(),
      reload: (prefixes, receiptsFor) =>
        reloadChatEventQueries(cache, runtime.key, prefixes, receiptsFor),
      ready: () => {
        if (disposed) return;
        failures = 0;
        setConnected(true);
        setError(undefined);
      },
    });
    const connect = async () => {
      if (disposed || !active || !runtime.isCurrent()) return;
      const control = new AbortController();
      abort = control;
      let token: string | null = null;
      try {
        token = await runtime.controller.getToken();
        runtime.assertCurrent();
        if (!token || disposed || control.signal.aborted) return;
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        };
        if (hydration.cursor) headers["Last-Event-ID"] = hydration.cursor;
        const response = await streamFetch(`${getApiUrl()}/events`, {
          headers,
          signal: control.signal,
        });
        runtime.assertCurrent();
        if (response.status !== 200) {
          if (
            response.status === 409 ||
            (response.status === 400 && hydration.cursor)
          )
            hydration.reset();
          if (response.status === 401) await runtime.controller.renew(token);
          throw new AppError("http", response.status);
        }
        if (
          !response.headers
            .get("content-type")
            ?.includes("text/event-stream") ||
          !response.body
        )
          throw new AppError("protocol");
        const reader = response.body.getReader(),
          decoder = new TextDecoder(),
          parser = createSseParser();
        try {
          while (!disposed && !control.signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) break;
            for (const frame of parser.feed(
              decoder.decode(chunk.value, { stream: true }),
            )) {
              if (disposed || control.signal.aborted) break;
              await hydration.handle(frame, control.signal);
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        if (!control.signal.aborted) throw new AppError("network");
      } catch (caught) {
        if (disposed || control.signal.aborted || !runtime.isCurrent()) return;
        setConnected(false);
        setError(caught);
        failures++;
        // SSE reconnect only; history is hydrated by events or explicit refresh.
        if (
          failures <= 6 &&
          !(caught instanceof AppError && caught.status === 403)
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
    const listener = AppState.addEventListener("change", (state) => {
      active = state === "active";
      abort?.abort();
      clearTimeout(timer);
      setConnected(false);
      if (active) {
        failures = 0;
        void connect();
      }
    });
    setConnected(false);
    setError(undefined);
    void connect();
    return () => {
      disposed = true;
      abort?.abort();
      clearTimeout(timer);
      listener.remove();
    };
  }, [runtime, cache, attempt]);
  return (
    <Context.Provider
      value={{ connected, error, retry: () => setAttempt((v) => v + 1) }}
    >
      {children}
    </Context.Provider>
  );
}
export function useChatEvents() {
  return useContext(Context);
}
