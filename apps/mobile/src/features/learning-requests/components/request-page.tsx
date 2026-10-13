import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { useRequestBack } from "../hooks/use-request-back";
export function RequestPage({
  title,
  children,
  fallback = "/requests",
  pending = false,
  feed = false,
  list = false,
  rightAction,
  footer,
}: Readonly<{
  title: string;
  children: ReactNode;
  fallback?: Href;
  pending?: boolean;
  feed?: boolean;
  list?: boolean;
  rightAction?: ReactNode;
  footer?: ReactNode;
}>) {
  const back = useRequestBack(fallback, pending);
  return (
    <AppScreenLayout
      title={title}
      rightAction={rightAction}
      selected={feed ? "Khám phá" : "Hồ sơ"}
      navigationBlocked={pending}
      back={{ href: fallback, label: "Quay lại", onPress: back }}
    >
      {() =>
        list ? (
          children
        ) : (
          <View style={{ flex: 1 }}>
            <KeyboardFormScrollView
              style={{ flex: 1 }}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={requestLayout.page}
            >
              {children}
            </KeyboardFormScrollView>
            {footer}
          </View>
        )
      }
    </AppScreenLayout>
  );
}
export const requestLayout = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  stack: { gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
});
