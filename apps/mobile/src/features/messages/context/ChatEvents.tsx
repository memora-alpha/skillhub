import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { fetch as streamFetch } from "expo/fetch";
import { getRandomValues } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/config/env";
import { AppError } from "@/lib/http/errors";
import { useConnections } from "@/features/connections";
import { createSseParser } from "../utils/sse-parser";
import {
  createChatEventHydrator,
  reloadChatEventQueries,
} from "../utils/event-hydration";
type EventBody = NonNullable<Awaited<ReturnType<typeof streamFetch>>["body"]>;
async function consumeEvents(
  body: EventBody,
  hydration: ReturnType<typeof createChatEventHydrator>,
  control: AbortController,
  disposed: () => boolean,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder(),
    parser = createSseParser();
  const stopped = () => disposed() || control.signal.aborted;
  const chunks = {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        stopped()
          ? Promise.resolve({ done: true as const, value: undefined })
          : reader.read(),
    }),
  };
  try {
    for await (const chunk of chunks) {
      // Each frame must finish reloading before the next can acknowledge a cursor.
      // A finite promise chain preserves stream order and stops on hydration failure.
      await parser.feed(decoder.decode(chunk, { stream: true })).reduce(
        (previous, frame) =>
          previous.then(async () => {
            if (!stopped()) await hydration.handle(frame, control.signal);
          }),
        Promise.resolve(),
      );
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const Context = createContext<{
  connected: boolean;
  error: unknown;
  retry: () => void;
}>({ connected: false, error: undefined, retry: () => {} });
export function ChatEventsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
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
    const responseBody = async (
      response: Awaited<ReturnType<typeof streamFetch>>,
      token: string,
    ) => {
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
        !response.headers.get("content-type")?.includes("text/event-stream") ||
        !response.body
      )
        throw new AppError("protocol");
      return response.body;
    };
    const failed = (error_: unknown, control: AbortController) => {
      if (disposed || control.signal.aborted || !runtime.isCurrent()) return;
      setConnected(false);
      setError(error_);
      failures++;
      // SSE reconnect only; history is hydrated by events or explicit refresh.
      if (
        failures <= 6 &&
        !(error_ instanceof AppError && error_.status === 403)
      )
        timer = setTimeout(
          () => {
            void connect();
          },
          Math.min(30000, 3000 * 2 ** (failures - 1)) +
            (getRandomValues(new Uint16Array(1))[0]! / 65536) * 500,
        );
    };
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
        const body = await responseBody(response, token);
        await consumeEvents(body, hydration, control, () => disposed);
        if (!control.signal.aborted) throw new AppError("network");
      } catch (error_) {
        failed(error_, control);
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
  const value = useMemo(
    () => ({ connected, error, retry: () => setAttempt((v) => v + 1) }),
    [connected, error],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useChatEvents() {
  return useContext(Context);
}
