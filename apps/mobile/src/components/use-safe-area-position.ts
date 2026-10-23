import type { ViewStyle } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

export function useSafeAreaPosition(
  offsets: Partial<Record<Edge, number>>,
): ViewStyle {
  const insets = useSafeAreaInsets();
  return Object.fromEntries(
    Object.entries(offsets).map(([edge, distance]) => [
      edge,
      insets[edge as Edge] + distance,
    ]),
  );
}
