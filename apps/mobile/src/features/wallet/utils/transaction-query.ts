import { queryOptions } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { WalletRuntime } from "../context/wallet-runtime";
import type { FinancialRead } from "../types/wallet";
import type { Transaction } from "../types/transaction";
import { validTransactionId } from "../schemas/transaction-contracts";
import {
  createTransactionApi,
  type TransactionClient,
} from "../api/transaction-api";
import { walletQueryKey } from "./wallet-query-keys";

type DetailData =
  { kind: "row"; row: Transaction } | { kind: "denied" | "not-found" };
export function transactionOptions(
  runtime: WalletRuntime | null,
  client: TransactionClient | null,
  id: string,
) {
  return queryOptions<DetailData>({
    queryKey: runtime
      ? walletQueryKey(runtime.scope, "transaction", id.toLowerCase())
      : ["wallet", "detail-unavailable"],
    enabled:
      !!runtime?.capabilities.transaction &&
      runtime.isCurrent() &&
      !!client &&
      validTransactionId(id),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      if (!runtime || !client || !validTransactionId(id))
        throw new AppError("protocol");
      try {
        const row = await runtime.read(
          "transaction",
          id.toLowerCase(),
          (s) => createTransactionApi(client).detail(id, s),
          signal,
        );
        return { kind: "row", row };
      } catch (error) {
        if (!runtime.isCurrent()) throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status))
          return { kind: error.status === 403 ? "denied" : "not-found" };
        throw error;
      }
    },
  });
}
export function projectTransaction(
  runtime: WalletRuntime | null,
  id: string,
  query: { data?: DetailData; error: unknown; isFetching: boolean },
): FinancialRead<Transaction> {
  if (runtime && !runtime.isCurrent())
    return { status: "session-ended", stale: false };
  if (!runtime?.capabilities.transaction || !validTransactionId(id))
    return { status: "unavailable", stale: false };
  if (query.data?.kind && query.data.kind !== "row")
    return { status: query.data.kind, stale: false };
  if (query.data?.kind === "row")
    return {
      status: query.isFetching
        ? "refreshing"
        : query.error
          ? "refresh-error"
          : "ready",
      data: query.data.row,
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
