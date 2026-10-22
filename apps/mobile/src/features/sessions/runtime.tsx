import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { createSessionsApi, type SessionsApi } from "./api/sessions-api";

type Runtime = {
  api: SessionsApi;
  userId: string;
  key: readonly [string, string, number];
  enabled: boolean;
  isCurrent: () => boolean;
};
const Context = createContext<Runtime | null>(null);
export function SessionsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { runtime, session, status } = useAuthSession();
  const generation = runtime.controller.generation;
  const userId = session?.userId ?? "";
  const client = useQueryClient();
  const value = useMemo<Runtime>(() => {
    const isCurrent = () =>
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready";
    return {
      api: createSessionsApi(runtime.client, userId, isCurrent),
      userId,
      key: ["sessions", userId, generation],
      enabled: status === "authenticated",
      isCurrent,
    };
  }, [runtime, userId, generation, status]);
  useEffect(() => {
    const key = value.key;
    return () => {
      void client.cancelQueries({ queryKey: key });
      client.removeQueries({ queryKey: key });
    };
  }, [client, value.key]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSessionsRuntime() {
  const context = useContext(Context);
  if (!context) throw new Error("SessionsProvider missing");
  return context;
}
