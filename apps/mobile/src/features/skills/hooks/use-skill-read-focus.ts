import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

export function useSkillReadFocus(
  refetch: () => Promise<unknown>,
  enabled = true,
) {
  const visited = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (visited.current) void refetch();
      visited.current = true;
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void refetch();
      });
      return () => subscription.remove();
    }, [refetch, enabled]),
  );
}
