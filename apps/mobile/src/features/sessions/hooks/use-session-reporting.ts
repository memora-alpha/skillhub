import { useEffect, useReducer } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useSessionDetail } from "./use-sessions";
import { useSessionsRuntime } from "../runtime";
import {
  sessionReportingState,
  reportRefreshDelay,
} from "../utils/session-reporting";
import { deviceTimezone, formatReportDeadline } from "../utils/session-time";

function reportingMessage(
  state: ReturnType<typeof sessionReportingState>,
  failed: boolean,
  checking: boolean,
) {
  if (state.reason === "DISPUTE_WINDOW_CLOSED") return state.message;
  if (failed) return "Chưa kiểm tra được điều kiện báo cáo. Vui lòng thử lại.";
  if (checking) return "Đang kiểm tra điều kiện báo cáo…";
  return state.message;
}

export function useSessionReporting(id: string | undefined) {
  const focused = useIsFocused();
  const query = useSessionDetail(id),
    runtime = useSessionsRuntime();
  const reporting = query.data?.reporting;
  const [, refreshClock] = useReducer((revision: number) => revision + 1, 0);
  const state = sessionReportingState(
    reporting,
    Date.now() - query.dataUpdatedAt,
  );
  const permitted =
    query.enabled && !query.error && !query.denial && state.allowed;
  const checking = query.enabled && query.isFetching;
  const refresh = query.refetch;
  useEffect(() => {
    const delay = reportRefreshDelay(
      reporting,
      Date.now() - query.dataUpdatedAt,
    );
    if (!focused || !query.enabled || delay === null || query.error) return;
    const timer = setTimeout(
      () => {
        if (runtime.isCurrent() && AppState.currentState === "active") {
          // Lock at the known cutoff before waiting for the refreshed BE response.
          refreshClock();
          void refresh({ cancelRefetch: false });
        }
      },
      Math.min(delay + 1, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [
    reporting,
    focused,
    query.dataUpdatedAt,
    query.enabled,
    query.error,
    runtime,
    refresh,
  ]);
  async function recheck() {
    if (
      !focused ||
      AppState.currentState !== "active" ||
      !query.enabled ||
      !runtime.isCurrent()
    )
      return false;
    try {
      const latest = await refresh({
        throwOnError: true,
        cancelRefetch: false,
      });
      return (
        runtime.isCurrent() &&
        !latest.error &&
        sessionReportingState(
          latest.data?.reporting,
          Date.now() - latest.dataUpdatedAt,
        ).allowed
      );
    } catch {
      return false;
    }
  }
  return {
    permitted,
    ready: permitted && !checking,
    checking,
    reason: state.reason,
    message: reportingMessage(state, !!query.error || !!query.denial, checking),
    deadlineShort: state.reportBy
      ? formatReportDeadline(state.reportBy, deviceTimezone())
      : null,
    retryable:
      !!query.error ||
      !!query.denial ||
      state.reason === "REPORT_POLICY_UNAVAILABLE",
    refresh: () => refresh({ cancelRefetch: false }),
    recheck,
  };
}
