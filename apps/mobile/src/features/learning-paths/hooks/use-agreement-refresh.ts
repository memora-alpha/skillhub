import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

// Read only. Never replay a command when the peer or connection changes.
export function useAgreementRefresh(
  refresh: () => Promise<unknown>,
  enabled: boolean,
  isCurrent: () => boolean,
) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let stopped = false;
      let inFlight = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        if (
          !stopped &&
          !inFlight &&
          timer === undefined &&
          isCurrent() &&
          AppState.currentState === "active"
        )
          timer = setTimeout(() => {
            void tick();
          }, 30_000);
      };
      const tick = async () => {
        timer = undefined;
        if (stopped || !isCurrent() || AppState.currentState !== "active")
          return;
        inFlight = true;
        try {
          await refresh();
        } catch {
          stopped = true;
        } finally {
          inFlight = false;
          schedule();
        }
      };
      schedule();
      const listener = AppState.addEventListener("change", (state) => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        if (state === "active") schedule();
      });
      return () => {
        stopped = true;
        if (timer !== undefined) clearTimeout(timer);
        listener.remove();
      };
    }, [enabled, refresh, isCurrent]),
  );
}
