import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  isTransientReadError,
  readRecoveryDelay,
} from "@/lib/query/use-quiet-read-recovery";
import type { Redemption } from "../api/reward-contracts";

type ReceiptQuery = Readonly<{
  data?: Pick<Redemption, "status">;
  isFetching: boolean;
  error: unknown;
  refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>;
}>;

export function useRedemptionRefresh(
  query: ReceiptQuery,
  enabled: boolean,
  isCurrent: () => boolean,
) {
  const latest = useRef(query);
  latest.current = query;
  const status = query.data?.status;
  useEffect(() => {
    if (!enabled || (status !== "ISSUING" && status !== "MANUAL_REVIEW"))
      return;
    let stopped = false;
    let reading = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const canRead = () => {
      const value = latest.current;
      return (
        !stopped &&
        !reading &&
        isCurrent() &&
        AppState.currentState === "active" &&
        !value.isFetching &&
        (value.data?.status === "ISSUING" ||
          value.data?.status === "MANUAL_REVIEW") &&
        (!value.error || isTransientReadError(value.error))
      );
    };
    const schedule = () => {
      clear();
      if (!canRead()) return;
      const value = latest.current;
      const interval = value.data?.status === "ISSUING" ? 10_000 : 30_000;
      const delay = isTransientReadError(value.error)
        ? Math.max(interval, readRecoveryDelay(value.error, 0))
        : interval;
      timer = setTimeout(() => {
        if (!canRead()) return;
        reading = true;
        // Refetch owner metadata through receipt; never replay a debit or call reveal.
        void latest.current
          .refetch({ cancelRefetch: false })
          .catch(() => undefined)
          .finally(() => {
            reading = false;
            schedule();
          });
      }, delay);
    };
    const listener = AppState.addEventListener("change", schedule);
    schedule();
    return () => {
      stopped = true;
      clear();
      listener.remove();
    };
  }, [enabled, status, query.isFetching, query.error, isCurrent]);
}
