import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { accountWalletCapabilities } from "./account-capabilities";
import { useAuthSession } from "@/features/auth";
import type { PaginatedHttpClient } from "@/lib/http/client";
import { createWalletRuntime, type WalletRuntime } from "./wallet-runtime";
import {
  attachPaymentPreparation,
  type PaymentPreparationSession,
} from "./payment-preparation";

type Value = WalletRuntime & {
  client: PaginatedHttpClient;
  preparation: PaymentPreparationSession;
};
const Context = createContext<Value | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { runtime, session, status } = useAuthSession();
  const ownerId = session?.userId,
    generation = runtime.controller.generation;
  const latest = useRef({ ownerId, generation, status });
  latest.current = { ownerId, generation, status };
  const current = useCallback(
    () =>
      latest.current.ownerId === ownerId &&
      latest.current.generation === generation &&
      latest.current.status === "authenticated" &&
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready",
    [ownerId, generation, runtime],
  );
  if (!ownerId || status !== "authenticated")
    return <Context.Provider value={null}>{children}</Context.Provider>;
  return (
    <WalletSession
      key={`${ownerId}:${generation}`}
      ownerId={ownerId}
      generation={generation}
      auth={runtime}
      current={current}
    >
      {children}
    </WalletSession>
  );
}
function WalletSession({
  ownerId,
  generation,
  auth,
  current,
  children,
}: {
  ownerId: string;
  generation: number;
  auth: ReturnType<typeof useAuthSession>["runtime"];
  current: () => boolean;
  children: ReactNode;
}) {
  const queries = useQueryClient();
  const value = useMemo(() => {
    const runtime = createWalletRuntime({
      scope: { ownerId, generation },
      queries,
      current,
      capabilities: accountWalletCapabilities(Platform.OS),
    });
    return {
      ...runtime,
      client: auth.client,
      preparation: attachPaymentPreparation(runtime),
    };
  }, [ownerId, generation, queries, current, auth]);
  useLayoutEffect(() => {
    // React Strict effects reactivate before child passive query subscriptions.
    value.activate();
    value.preparation.activate();
    // Controller subscription invalidates synchronously, before React cleanup.
    const unsubscribe = auth.controller.subscribe(() => {
      if (!value.isCurrent()) value.dispose();
    });
    value.addCleanup(unsubscribe);
    return value.dispose;
  }, [value, auth]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWalletRuntime() {
  const value = useContext(Context);
  if (!value) throw new Error("Authenticated WalletProvider is required");
  return value;
}
// Account gating may remove a consumer after this render. Hide private data now.
export function useOptionalWalletRuntime() {
  return useContext(Context);
}
