import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useConnections } from "@/features/connections";
import { useRewards } from "../context/rewards-provider";
import type { VoucherSecret } from "../api/reward-contracts";

export function useVoucherSecret(id: string) {
  const { api } = useRewards();
  const runtime = useConnections();
  const [secret, setSecret] = useState<VoucherSecret | null>(null);
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const active = useRef(false);
  const hide = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setSecret(null);
    setError(undefined);
    setPending(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      const listener = AppState.addEventListener("change", (state) => {
        active.current = state === "active";
        if (!active.current) hide();
      });
      return () => {
        active.current = false;
        hide();
        listener.remove();
      };
    }, [hide, id, runtime]),
  );
  const reveal = async () => {
    if (request.current || !active.current || !runtime.isCurrent()) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(undefined);
    try {
      const result = await api.reveal(id, controller.signal);
      if (!controller.signal.aborted && active.current && runtime.isCurrent())
        setSecret(result.voucher);
    } catch (cause) {
      if (!controller.signal.aborted && active.current && runtime.isCurrent())
        setError(cause);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  };
  return { secret, pending, error, reveal, hide };
}
