import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { randomUUID } from "expo-crypto";
import { getApiUrl } from "@/config/env";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import {
  attachPaymentCreate,
  focusPaymentCreate,
} from "../context/payment-create-session";
import { createPaymentApi } from "../api/payment-api";
import { openPaymentStore } from "../storage/payment-correlation-store";
import type { PaymentCreateSnapshot } from "../utils/payment-create-state";
import { usePaymentAutoRead } from "./use-payment-auto-read";

const unavailable: PaymentCreateSnapshot = Object.freeze({
  stage: "ended",
  draft: "",
  busy: false,
});
const noop = () => () => {};
export function useOwnerPaymentCreate({
  observe = false,
}: { observe?: boolean } = {}) {
  const runtime = useOptionalWalletRuntime(),
    focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  let environment = "";
  try {
    environment = getApiUrl();
  } catch {
    /* Invalid configuration stays unavailable. */
  }
  const model = useMemo(() => {
    if (
      !runtime?.capabilities.createPayment ||
      !runtime.capabilities.recovery ||
      !environment
    )
      return null;
    const identity = { ownerId: runtime.scope.ownerId, environment };
    return attachPaymentCreate(runtime, {
      identity,
      api: createPaymentApi(runtime.client),
      newKey: randomUUID,
      openStore: () => openPaymentStore(identity, runtime.isCurrent),
    });
  }, [runtime, environment]);
  const state = useSyncExternalStore(
    model?.subscribe ?? noop,
    model?.getSnapshot ?? (() => unavailable),
    () => unavailable,
  );
  const lease = useRef<ReturnType<typeof focusPaymentCreate> | null>(null);
  const active = !!model && focused && foreground && !!runtime?.isCurrent();
  const isActive = useCallback(
    () => !!lease.current?.current() && AppState.currentState !== "background",
    [],
  );
  const navigationEpoch = useCallback(() => lease.current, []);
  useFocusEffect(
    useCallback(() => {
      if (!model || !runtime) return;
      const resume = () => {
        setForeground(true);
        lease.current = focusPaymentCreate(runtime, environment, model);
        const snapshot = model.getSnapshot();
        if (
          ["loading", "ended"].includes(snapshot.stage) ||
          snapshot.canRestore
        )
          void model.bootstrap();
        else if (snapshot.paymentId) void model.check();
        // Unknown outcomes require an explicit same-key replay; no lifecycle POST.
      };
      if (AppState.currentState !== "background") resume();
      const listener = AppState.addEventListener("change", (next) => {
        setForeground(next === "active");
        if (next === "active") resume();
        else {
          lease.current?.release();
          lease.current = null;
        }
      });
      return () => {
        listener.remove();
        lease.current?.release();
        lease.current = null;
      };
    }, [model, runtime, environment]),
  );
  const watching = usePaymentAutoRead({
    active: active && observe,
    id: state.readTargetId,
    current: isActive,
    snapshot: () => {
      const s = model?.getSnapshot();
      return {
        id: s?.readTargetId,
        status: s?.payment?.status,
        denied: s?.readDenied,
        stale: !!s?.observation?.stale,
      };
    },
    read: () => model?.check() ?? Promise.resolve(),
  });
  return { model, state, active, isActive, navigationEpoch, watching };
}
