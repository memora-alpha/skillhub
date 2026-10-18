import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { HttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import type { WalletRuntime } from "../context/wallet-runtime";
import type { FinancialRead } from "../types/wallet";
import type { PaymentProjection } from "../types/payment";
import { validPaymentId } from "../schemas/payment-contracts";
import { createPaymentApi } from "../api/payment-api";
import {
  createPaymentObservation,
  reducePaymentObservation,
  type PaymentLiveObservation,
} from "./payment-observation";
import { paymentDetailKey } from "./payment-query-keys";

type Entry = {
  observation?: PaymentLiveObservation;
  denial?: "denied" | "not-found";
  ticket: number;
};
export type PaymentReadValue = Pick<Entry, "observation" | "denial">;
export type PaymentRead = FinancialRead<PaymentProjection> & {
  issue?: "conflict";
};
function entry(runtime: WalletRuntime, id: string): Entry {
  const name = `payment-read:${id}`;
  let value = runtime.sessionData.get(name) as Entry | undefined;
  if (!value) {
    value = { ticket: 0 };
    runtime.sessionData.set(name, value);
  }
  return value;
}
export function paymentReadOptions(
  runtime: WalletRuntime | null,
  client: Pick<HttpClient, "request"> | null,
  id: string,
  queries: QueryClient,
) {
  const key = runtime
    ? paymentDetailKey(runtime.scope, id)
    : ["wallet", "payment-unavailable"];
  const enabled =
    !!runtime?.capabilities.paymentStatus &&
    runtime.isCurrent() &&
    !!client &&
    validPaymentId(id);
  return queryOptions<PaymentReadValue>({
    queryKey: key,
    enabled,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      if (!runtime || !client || !enabled || !runtime.isCurrent())
        throw new AppError("config");
      const state = entry(runtime, id),
        started = ++state.ticket;
      const valid = () =>
        runtime.isCurrent() && !signal.aborted && state.ticket === started;
      try {
        const data = await runtime.read(
          "paymentStatus",
          `detail:${id}`,
          (s) => createPaymentApi(client).detail(id, s),
          signal,
        );
        if (!valid()) throw new AppError("session");
        const previous =
          state.observation ??
          createPaymentObservation({ scope: runtime.scope, paymentId: id });
        state.observation = reducePaymentObservation(previous, {
          scope: runtime.scope,
          paymentId: id,
          ticket: started,
          currentTicket: state.ticket,
          data,
        });
        state.denial = undefined;
        return { observation: state.observation };
      } catch (error) {
        if (!valid()) throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status)) {
          state.observation = undefined;
          state.denial = error.status === 403 ? "denied" : "not-found";
          queries.setQueryData<PaymentReadValue>(key, { denial: state.denial });
          return { denial: state.denial };
        }
        throw error;
      }
    },
  });
}
export function projectPaymentRead(
  runtime: WalletRuntime | null,
  id: string,
  query: { data?: PaymentReadValue; error: unknown; isFetching: boolean },
): PaymentRead {
  if (runtime && !runtime.isCurrent())
    return { status: "session-ended", stale: false };
  if (!runtime?.capabilities.paymentStatus || !validPaymentId(id))
    return { status: "unavailable", stale: false };
  // Session-owned tombstone/latch precedes any Query cancellation revert data.
  const state = entry(runtime, id);
  if (state.denial) return { status: state.denial, stale: false };
  const observation = state.observation,
    data = observation?.data;
  if (data)
    return {
      status: query.isFetching
        ? "refreshing"
        : query.error || observation.stale
          ? "refresh-error"
          : "ready",
      data,
      stale: query.isFetching || !!query.error || observation.stale,
      ...(observation.issue ? { issue: observation.issue } : {}),
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
export async function pausePaymentRead(
  queries: QueryClient,
  runtime: WalletRuntime | null,
  id: string,
) {
  if (!runtime || !validPaymentId(id)) return;
  const state = runtime.sessionData.get(`payment-read:${id}`) as
    Entry | undefined;
  if (state) state.ticket++;
  await queries.cancelQueries({
    queryKey: paymentDetailKey(runtime.scope, id),
    exact: true,
  });
  if (state?.denial)
    queries.setQueryData(paymentDetailKey(runtime.scope, id), {
      denial: state.denial,
    });
}
