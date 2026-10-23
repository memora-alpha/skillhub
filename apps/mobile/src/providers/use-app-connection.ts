import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { getNetworkStateAsync, useNetworkState } from "expo-network";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { connectionStore, deviceOffline } from "@/lib/network/connection-store";
import { probeConnection } from "@/lib/network/probe-connection";
import { createReadRefresh } from "@/lib/query/refresh-active-reads";

export function useAppConnection() {
  const state = useSyncExternalStore(
    connectionStore.subscribe,
    connectionStore.getSnapshot,
    connectionStore.getSnapshot,
  );
  const network = useNetworkState();
  const { runtime } = useAuthSession();
  const queryClient = useQueryClient();
  const previousOffline = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const retry = useCallback(async () => {
    const ticket = connectionStore.beginRetry();
    if (ticket === null) return;
    let connected = false;
    try {
      if (deviceOffline(await getNetworkStateAsync())) {
        connectionStore.unavailable("offline");
        return;
      }
      await probeConnection();
      if (!mounted.current) return;
      if (runtime.controller.getSnapshot() === "offline")
        await runtime.controller.bootstrap();
      // Refetch read queries only. Never replay a save, upload or submission.
      await createReadRefresh(queryClient)();
      connected = !deviceOffline(await getNetworkStateAsync());
    } catch {
      if (mounted.current) connectionStore.unavailable();
    } finally {
      connectionStore.finishRetry(ticket, connected && mounted.current);
    }
  }, [queryClient, runtime]);
  useEffect(() => {
    const offline = deviceOffline(network);
    if (offline) connectionStore.unavailable("offline");
    else if (previousOffline.current) {
      connectionStore.deviceConnected();
      void retry();
    }
    previousOffline.current = offline;
  }, [network.isConnected, network.isInternetReachable, retry]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active" && connectionStore.getSnapshot().reason)
        void retry();
    });
    return () => listener.remove();
  }, [retry]);
  return { ...state, retry };
}
