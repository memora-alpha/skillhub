import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { createRequestsApi } from "./api/requests-api";
type RequestsRuntime = {
  api: ReturnType<typeof createRequestsApi>;
  key: readonly [string, string | undefined, number];
  isCurrent: () => boolean;
  enabled: boolean;
};
const Context = createContext<RequestsRuntime | null>(null);
export function RequestsProvider({ children }: { children: ReactNode }) {
  const { runtime, session, status } = useAuthSession();
  const generation = runtime.controller.generation;
  const queryClient = useQueryClient();
  const value = useMemo<RequestsRuntime>(() => {
    const isCurrent = () =>
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready";
    return {
      api: createRequestsApi(runtime.client, isCurrent),
      key: ["learning-requests", session?.userId, generation],
      isCurrent,
      enabled: status === "authenticated",
    };
  }, [runtime, generation, session?.userId, status]);
  useEffect(() => {
    const key = value.key;
    return () => {
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.removeQueries({ queryKey: key });
    };
  }, [queryClient, value.key]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRequestsRuntime() {
  const value = useContext(Context);
  if (!value) throw new Error("RequestsProvider missing");
  return value;
}
