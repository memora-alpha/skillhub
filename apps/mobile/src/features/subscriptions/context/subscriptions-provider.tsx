import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useConnections } from "@/features/connections";
import { useRefreshWallet } from "@/features/wallet";
import { getApiUrl } from "@/config/env";
import { createSubscriptionsApi } from "../api/subscriptions-api";
import { openSubscriptionStore } from "../storage/subscription-store";
import { SubscriptionCoordinator } from "../utils/subscription-coordinator";

type Value = {
  api: ReturnType<typeof createSubscriptionsApi>;
  model: SubscriptionCoordinator;
  changed: () => void;
};
const Context = createContext<Value | null>(null);
export function SubscriptionsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const runtime = useConnections();
  return (
    <ScopedProvider key={JSON.stringify(runtime.key)}>
      {children}
    </ScopedProvider>
  );
}
function ScopedProvider({ children }: Readonly<{ children: ReactNode }>) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const api = useMemo(() => createSubscriptionsApi(runtime.call), [runtime]);
  const changed = useMemo(
    () => () => {
      if (!runtime.isCurrent()) return;
      void cache.invalidateQueries({
        queryKey: [...runtime.key, "subscriptions"],
      });
      void refreshWallet()?.catch(() => undefined);
    },
    [cache, runtime, refreshWallet],
  );
  const [model] = useState(
    () =>
      new SubscriptionCoordinator({
        openStore: () =>
          openSubscriptionStore(runtime.userId ?? "", getApiUrl()),
        send: api.send,
        createKey: randomUUID,
        isCurrent: runtime.isCurrent,
        changed,
      }),
  );
  useEffect(() => {
    if (runtime.enabled) void model.load();
  }, [model, runtime.enabled]);
  return (
    <Context.Provider value={{ api, model, changed }}>
      {children}
    </Context.Provider>
  );
}
export function useSubscriptions() {
  const value = useContext(Context);
  if (!value) throw new Error("SubscriptionsProvider missing");
  const state = useSyncExternalStore(
    value.model.subscribe,
    value.model.getSnapshot,
    value.model.getSnapshot,
  );
  return { ...value, state };
}
