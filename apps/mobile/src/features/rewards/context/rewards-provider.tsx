import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { useRefreshWallet } from "@/features/wallet";
import { getApiUrl } from "@/config/env";
import { createRewardsApi, type RewardsApi } from "../api/rewards-api";
import { openRedemptionStore } from "../storage/redemption-store";
import { RedemptionCoordinator } from "../utils/redemption-coordinator";

const Context = createContext<{
  api: RewardsApi;
  model: RedemptionCoordinator;
} | null>(null);
export function RewardsProvider({
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
  const api = useMemo(() => createRewardsApi(runtime.call), [runtime]);
  const [model] = useState(
    () =>
      new RedemptionCoordinator({
        openStore: () => openRedemptionStore(runtime.userId ?? "", getApiUrl()),
        send: api.redeem,
        createKey: randomUUID,
        isCurrent: runtime.isCurrent,
        changed: () => {
          if (!runtime.isCurrent()) return;
          void cache.invalidateQueries({
            queryKey: [...runtime.key, "rewards"],
          });
          void refreshWallet()?.catch(() => undefined);
        },
      }),
  );
  useEffect(() => {
    if (runtime.enabled) void model.load();
  }, [model, runtime.enabled]);
  const value = useMemo(() => ({ api, model }), [api, model]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRewards() {
  const context = useContext(Context);
  if (!context) throw new Error("RewardsProvider missing");
  const state = useSyncExternalStore(
    context.model.subscribe,
    context.model.getSnapshot,
    context.model.getSnapshot,
  );
  return { ...context, state };
}
