import { useRef } from "react";
import { RefreshControl, type ScrollViewProps } from "react-native";
import { useAppRefresh } from "@/providers/AppRefreshProvider";
import { appColors } from "@/constants/theme";

export function useScrollRefresh(
  props: ScrollViewProps & {
    refreshing?: boolean | null;
    onRefresh?: (() => void) | null;
  },
) {
  const app = useAppRefresh();
  const scrollY = useRef(0);
  const enabled = !props.horizontal && props.scrollEnabled !== false;
  const refreshing = !!props.refreshing || app.refreshing;
  const refresh = () => {
    if (refreshing) return;
    if (props.onRefresh) props.onRefresh();
    else void app.refresh();
  };
  return {
    boundary: { enabled, refreshing, refresh, scrollY },
    scroll: {
      scrollEventThrottle: props.scrollEventThrottle ?? 16,
      alwaysBounceVertical: enabled,
      onScroll: (
        event: Parameters<NonNullable<ScrollViewProps["onScroll"]>>[0],
      ) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
        props.onScroll?.(event);
      },
      refreshControl:
        props.refreshControl ??
        (enabled ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={appColors.primary}
            colors={[appColors.primary]}
          />
        ) : undefined),
    },
  };
}
