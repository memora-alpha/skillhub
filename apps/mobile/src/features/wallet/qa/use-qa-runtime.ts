import { useLayoutEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../context/wallet-runtime";
import type { PaymentQaBinding } from "@/qa/payment-qa-binding";
import { selectPaymentQa } from "@/qa/payment-qa-binding";
import { getApiUrl } from "@/config/env";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Uses existing providers/client; no parallel auth, credential store or provider.
export function useQaRuntime(binding: PaymentQaBinding) {
  const source = useOptionalWalletRuntime(),
    queries = useQueryClient();
  let environment = "";
  try {
    environment = getApiUrl();
  } catch {
    /* Binding stays unavailable. */
  }
  const eligible =
    !!source &&
    !!selectPaymentQa(binding, {
      platform: Platform.OS,
      environment,
      ownerId: source.scope.ownerId,
      buildId: Constants.nativeBuildVersion ?? "",
    });
  const runtime = useMemo(
    () =>
      source && eligible
        ? Object.assign(
            createWalletRuntime({
              scope: source.scope,
              queries,
              current: source.isCurrent,
              capabilities: {
                ...noWalletCapabilities,
                paymentStatus: true,
                wallet: true,
                history: true,
              },
            }),
            { client: source.client },
          )
        : null,
    [
      source,
      queries,
      eligible,
      binding.environment,
      binding.buildId,
      binding.mode,
    ],
  );
  useLayoutEffect(() => {
    runtime?.activate();
    const unregister = source?.addCleanup(() => runtime?.dispose());
    return () => {
      unregister?.();
      runtime?.dispose();
    };
  }, [runtime, source]);
  return runtime;
}
