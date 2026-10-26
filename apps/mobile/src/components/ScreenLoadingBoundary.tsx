import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useIsFocused } from "expo-router";
import { appColors } from "@/constants/theme";
import { LoadingIndicator } from "./LoadingIndicator";
import { createScreenLoadingStore } from "./screen-loading-store";
import { ScreenLoadingContext } from "./use-screen-loading";
import { ScreenLoadingContent } from "./ScreenLoadingContent";

export function ScreenLoadingBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const store = useMemo(createScreenLoadingStore, []);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const focused = useIsFocused();
  const waiting = snapshot.busy && focused;
  return (
    <ScreenLoadingContext.Provider value={store}>
      <View style={styles.frame}>
        <ScreenLoadingContent waiting={waiting}>
          {children}
        </ScreenLoadingContent>
        {waiting && (
          <View style={styles.waiting} pointerEvents="none">
            <LoadingIndicator
              presentation="inline"
              size="large"
              accessibilityLabel="Đang tải nội dung"
            />
          </View>
        )}
      </View>
    </ScreenLoadingContext.Provider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0 },
  waiting: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.canvas,
  },
});
