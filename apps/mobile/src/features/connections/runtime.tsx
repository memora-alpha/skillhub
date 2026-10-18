import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { AppError } from "@/lib/http/errors";
import type { RequestOptions } from "@/lib/http/client";

function useRuntimeValue() {
  const { runtime, session, status } = useAuthSession();
  const generation = runtime.controller.generation;
  return useMemo(() => {
    const isCurrent = () =>
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready";
    const assertCurrent = () => {
      if (!isCurrent()) throw new AppError("session");
    };
    return {
      key: ["connections", session?.userId, generation] as const,
      userId: session?.userId,
      enabled: status === "authenticated",
      isCurrent,
      assertCurrent,
      controller: runtime.controller,
      call: async (path: string, options: RequestOptions = {}) => {
        assertCurrent();
        const result = await runtime.client.request(path, {
          ...options,
          authenticated: true,
        });
        assertCurrent();
        return result;
      },
    };
  }, [runtime, session?.userId, generation, status]);
}
type Runtime = ReturnType<typeof useRuntimeValue>;
const Context = createContext<Runtime | null>(null);
export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const value = useRuntimeValue();
  const cache = useQueryClient();
  useEffect(() => {
    const key = value.key;
    return () => {
      void cache.cancelQueries({ queryKey: key });
      cache.removeQueries({ queryKey: key });
    };
  }, [cache, value.key]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useConnections() {
  const value = useContext(Context);
  if (!value) throw new Error("ConnectionsProvider missing");
  return value;
}
