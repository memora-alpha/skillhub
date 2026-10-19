import { Platform } from "react-native";
import Constants from "expo-constants";
import type { ReactNode } from "react";
import { getApiUrl } from "@/config/env";
import { useAuthSession } from "@/features/auth";
import { PaymentReadQaHost, PaymentFinancialQaHost } from "@/features/wallet";
import { selectPaymentQa } from "./payment-qa-binding";

export function PaymentQaEntry({ children }: { children: ReactNode }) {
  const { session, status } = useAuthSession();
  if (status !== "authenticated") return children;
  const raw = Constants.expoConfig?.extra?.paymentQa;
  let environment = "";
  try {
    environment = getApiUrl();
  } catch {
    /* Invalid binding stays normal/unavailable. */
  }
  const binding = selectPaymentQa(raw, {
    platform: Platform.OS,
    environment,
    ownerId: session?.userId ?? "",
    buildId: Constants.nativeBuildVersion ?? "",
  });
  if (binding?.mode === "financial")
    return <PaymentFinancialQaHost binding={binding} />;
  return binding?.mode === "read" ? (
    <PaymentReadQaHost binding={binding} />
  ) : (
    children
  );
}
