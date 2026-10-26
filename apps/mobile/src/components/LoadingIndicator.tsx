import { useEffect, useState } from "react";
import { useLoadingVisible } from "./LoadingScreenBoundary";
import {
  useScreenLoading,
  type LoadingPresentation,
} from "./use-screen-loading";
import { appColors } from "@/constants/theme";
export type { LoadingPresentation } from "./use-screen-loading";
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { type CSSAnimationKeyframes } from "react-native-reanimated";

const dotColors = { peach: "#F07850", mint: "#40AF91" } as const;

const firstDot: CSSAnimationKeyframes<ViewStyle> = {
  "0%, 100%": { transform: [{ translateX: -10 }, { scale: 0.85 }] },
  "25%": { transform: [{ translateX: 0 }, { scale: 1.1 }] },
  "50%": { transform: [{ translateX: 10 }, { scale: 0.85 }] },
  "75%": { transform: [{ translateX: 0 }, { scale: 0.7 }] },
};
const secondDot: CSSAnimationKeyframes<ViewStyle> = {
  "0%, 100%": { transform: [{ translateX: 10 }, { scale: 0.85 }] },
  "25%": { transform: [{ translateX: 0 }, { scale: 0.7 }] },
  "50%": { transform: [{ translateX: -10 }, { scale: 0.85 }] },
  "75%": { transform: [{ translateX: 0 }, { scale: 1.1 }] },
};

export function LoadingIndicator({
  accessibilityLabel = "Đang tải dữ liệu",
  style,
  size,
  animating = true,
  busy = true,
  presentation = "screen",
}: Readonly<{
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  size?: "small" | "large" | number;
  animating?: boolean;
  busy?: boolean;
  presentation?: LoadingPresentation;
}>) {
  const focused = useLoadingVisible();
  const grouped = useScreenLoading(presentation, busy, accessibilityLabel);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let current = true,
      preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        preferenceChanged = true;
        setReducedMotion(value);
      },
    );
    const app = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (current && !preferenceChanged) setReducedMotion(value);
      })
      .catch(() => {});
    return () => {
      current = false;
      motion.remove();
      app.remove();
    };
  }, []);
  if (grouped || presentation === "silent") return null;
  if (presentation === "placeholder")
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy }}
        style={[styles.placeholder, style]}
      />
    );
  const moving = animating && focused && foreground && !reducedMotion;
  let scale = 1;
  if (size === "small") scale = 0.7;
  else if (size === "large") scale = 1.35;
  else if (typeof size === "number") scale = Math.max(0.5, size / 28);
  const animation = {
    animationDuration: "1s" as const,
    animationTimingFunction: "ease-in-out" as const,
    animationIterationCount: "infinite" as const,
  };
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityState={{ busy }}
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      style={[
        styles.container,
        { width: 48 * scale, minHeight: 28 * scale },
        style,
      ]}
    >
      <View
        style={[styles.track, { transform: [{ scale }] }]}
        accessible={false}
      >
        <Animated.View
          accessible={false}
          style={[
            styles.dot,
            {
              backgroundColor: dotColors.peach,
              transform: [{ translateX: -10 }, { scale: 0.85 }],
              ...animation,
              animationName: moving ? firstDot : undefined,
            },
          ]}
        />
        <Animated.View
          accessible={false}
          style={[
            styles.dot,
            {
              backgroundColor: dotColors.mint,
              transform: [{ translateX: 10 }, { scale: 0.85 }],
              ...animation,
              animationName: moving ? secondDot : undefined,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
  },
  placeholder: {
    minHeight: 28,
    width: "100%",
    borderRadius: 8,
    backgroundColor: appColors.surfaceInset,
  },
  track: { width: 48, height: 24 },
  dot: {
    position: "absolute",
    left: 18,
    top: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
