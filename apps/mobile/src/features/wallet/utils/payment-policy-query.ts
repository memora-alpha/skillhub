import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { HttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import type { WalletRuntime } from "../context/wallet-runtime";
import type { FinancialRead } from "../types/wallet";
import type { PaymentCreationPolicy } from "../types/payment";
import { createPaymentApi } from "../api/payment-api";
import { paymentPolicyKey } from "./payment-query-keys";

type Value = { data?: PaymentCreationPolicy; denied?: boolean };
export function paymentPolicyOptions(
  runtime: WalletRuntime | null,
  client: Pick<HttpClient, "request"> | null,
  queries: QueryClient,
  environment: string,
) {
  const key = runtime
    ? paymentPolicyKey(runtime.scope, environment)
    : ["wallet", "policy-unavailable"];
  const enabled =
    !!runtime?.capabilities.paymentStatus && runtime.isCurrent() && !!client;
  return queryOptions<Value>({
    queryKey: key,
    enabled,
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      if (!runtime || !client || !enabled) throw new AppError("config");
      try {
        const data = await runtime.read(
          "paymentStatus",
          "creation-policy",
          (s) => createPaymentApi(client).creationPolicy(s),
          signal,
        );
        runtime.sessionData.delete("policy-denied");
        return { data };
      } catch (error) {
        if (!runtime.isCurrent() || signal.aborted)
          throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status)) {
          runtime.sessionData.set("policy-denied", true);
          queries.setQueryData(key, { denied: true });
          return { denied: true };
        }
        throw error;
      }
    },
  });
}
export function projectPaymentPolicy(
  runtime: WalletRuntime | null,
  value: Value | undefined,
  error: unknown,
  busy: boolean,
): FinancialRead<PaymentCreationPolicy> {
  if (!runtime?.isCurrent()) return { status: "session-ended", stale: false };
  if (!runtime.capabilities.paymentStatus)
    return { status: "unavailable", stale: false };
  if (runtime.sessionData.get("policy-denied") || value?.denied)
    return { status: "denied", stale: false };
  if (value?.data)
    return {
      status: busy ? "refreshing" : error ? "refresh-error" : "ready",
      data: value.data,
      stale: busy || !!error,
    };
  return {
    status: busy ? "loading" : error ? "error" : "unavailable",
    stale: false,
  };
}
