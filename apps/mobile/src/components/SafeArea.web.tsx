import type { ComponentProps, PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import type { SafeAreaViewProps } from "react-native-safe-area-context";
import { webSafeAreaSpacing } from "@/utils/web-safe-area";

type Props = ComponentProps<typeof View> &
  Pick<SafeAreaViewProps, "mode" | "edges">;

export function SafeAreaView({ style, mode, edges, ...props }: Props) {
  return (
    <View
      {...props}
      style={[
        style,
        webSafeAreaSpacing(StyleSheet.flatten(style) ?? undefined, edges, mode),
      ]}
    />
  );
}

// Router 58 owns the web provider; extra measurements can interrupt hydration.
export function SafeAreaProvider({ children }: PropsWithChildren) {
  return children;
}
