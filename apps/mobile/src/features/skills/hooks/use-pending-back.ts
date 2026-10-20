import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
export function usePendingBack(locked: () => boolean) {
  const guard = useRef(locked);
  guard.current = locked;
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const listener = BackHandler.addEventListener("hardwareBackPress", () =>
        guard.current(),
      );
      return () => listener.remove();
    }, []),
  );
}
