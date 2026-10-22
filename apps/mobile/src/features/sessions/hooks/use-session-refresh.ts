import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

// No session event is currently exposed over SSE. Only refresh reads while
// focused and foregrounded so the peer's confirmation can become visible.
export function useSessionRefresh(
  refresh: () => Promise<unknown>,
  enabled: boolean,
  isCurrent: () => boolean,
) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let busy = false;
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        if (
          stopped ||
          busy ||
          timer ||
          !isCurrent() ||
          AppState.currentState !== "active"
        )
          return;
        timer = setTimeout(() => {
          void tick();
        }, 30_000);
      };
      const tick = async () => {
        timer = undefined;
        if (stopped || !isCurrent() || AppState.currentState !== "active")
          return;
        busy = true;
        try {
          await refresh();
        } catch {
          stopped = true;
        } finally {
          busy = false;
          schedule();
        }
      };
      schedule();
      const listener = AppState.addEventListener("change", () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
        schedule();
      });
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        listener.remove();
      };
    }, [enabled, refresh, isCurrent]),
  );
}
