import { queryOptions } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { HttpClient } from "@/lib/http/client";
import type { WalletRuntime } from "../context/wallet-runtime";
import type { FinancialRead, WalletSnapshot } from "../types/wallet";
import { createWalletApi } from "../api/wallet-api";
import { walletQueryKey } from "./wallet-query-keys";

// Local cache value, not an HTTP envelope. Denial replaces (evicts) all money.
type WalletReadValue =
  | { kind: "snapshot"; snapshot: WalletSnapshot }
  | { kind: "denied" | "not-found" };
export function walletReadOptions(
  runtime: WalletRuntime | null,
  client: Pick<HttpClient, "request"> | null,
) {
  return queryOptions<WalletReadValue>({
    queryKey: runtime
      ? walletQueryKey(runtime.scope, "balance")
      : ["wallet", "unavailable"],
    enabled: !!runtime?.capabilities.wallet && runtime.isCurrent() && !!client,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      if (!runtime || !client) throw new AppError("config");
      try {
        const snapshot = await runtime.read(
          "wallet",
          "balance",
          (s) => createWalletApi(client).read(s),
          signal,
        );
        return { kind: "snapshot", snapshot };
      } catch (error) {
        if (!runtime.isCurrent()) throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status))
          return { kind: error.status === 403 ? "denied" : "not-found" };
        throw error;
      }
    },
  });
}
export function projectWalletRead(
  runtime: WalletRuntime | null,
  query: { data?: WalletReadValue; error: unknown; isFetching: boolean },
): FinancialRead<WalletSnapshot> {
  if (runtime && !runtime.isCurrent())
    return { status: "session-ended", stale: false };
  if (!runtime?.capabilities.wallet)
    return { status: "unavailable", stale: false };
  const data = query.data;
  if (data && data.kind !== "snapshot")
    return { status: data.kind, stale: false };
  if (data?.kind === "snapshot")
    return {
      status: query.isFetching
        ? "refreshing"
        : query.error
          ? "refresh-error"
          : "ready",
      data: data.snapshot,
      stale: query.isFetching || !!query.error,
    };
  return {
    status: query.isFetching
      ? "loading"
      : query.error
        ? "error"
        : "unavailable",
    stale: false,
  };
}
