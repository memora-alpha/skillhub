import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useFocusEffect } from "expo-router";

export function useNotificationMotion() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [reduceMotion, setReduceMotion] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    let current = true;
    let preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        preferenceChanged = true;
        setReduceMotion(value);
      },
    );
    const app = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (current && !preferenceChanged) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      current = false;
      motion.remove();
      app.remove();
    };
  }, []);

  return focused && foreground && !reduceMotion;
}
