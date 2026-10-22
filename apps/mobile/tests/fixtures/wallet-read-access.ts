import { AppError } from "@/lib/http/errors";
import type { FinancialRead } from "../../src/features/wallet/types/wallet";

// A resource-local observation guard, not a second account-wide query cache.
export function createReadAccess<T>({
  available,
  current = () => true,
  onDenied,
  empty = () => false,
}: {
  available: boolean;
  current?: () => boolean;
  onDenied?: () => void;
  empty?: (data: T) => boolean;
}) {
  let state: FinancialRead<T> = { status: "unavailable", stale: false };
  let ticket = 0,
    ended = false;
  let denial: "denied" | "not-found" | undefined;
  const valid = (observation: number) =>
    available && ticket > 0 && !ended && current() && observation === ticket;
  const getSnapshot = (): FinancialRead<T> =>
    ended || !current() ? { status: "session-ended", stale: false } : state;
  return {
    getSnapshot,
    begin: () => {
      if (ended || !current() || !available) return null;
      ticket++;
      state =
        state.data !== undefined
          ? { status: "refreshing", data: state.data, stale: true }
          : { status: "loading", stale: false };
      return ticket;
    },
    accept: (observation: number, data: T) => {
      if (!valid(observation)) return;
      denial = undefined;
      state = { status: empty(data) ? "empty" : "ready", data, stale: false };
    },
    reject: (observation: number, error: unknown) => {
      if (!valid(observation)) return;
      if (error instanceof AppError && [403, 404].includes(error.status)) {
        denial = error.status === 403 ? "denied" : "not-found";
        state = { status: denial, stale: false };
        onDenied?.();
      } else if (denial) state = { status: denial, stale: false };
      else
        state =
          state.data !== undefined
            ? { status: "refresh-error", data: state.data, stale: true }
            : { status: "error", stale: false };
    },
    endSession: () => {
      ended = true;
      ticket++;
      denial = undefined;
      state = { status: "session-ended", stale: false };
    },
  };
}
