import { useEffect, useRef, useState } from "react";
import { Platform, RefreshControl, type ScrollViewProps } from "react-native";
import { useAppRefresh } from "@/providers/AppRefreshProvider";
import { pullDistance } from "@/utils/pull-refresh";
import { useLoadingVisible } from "./LoadingScreenBoundary";

export function useScrollRefresh(
  props: ScrollViewProps & {
    refreshing?: boolean | null;
    onRefresh?: (() => void) | null;
  },
) {
  const app = useAppRefresh();
  const visible = useLoadingVisible();
  const scrollY = useRef(0);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const preview = useRef(false);
  const [pulling, setPulling] = useState(false);
  const showPreview = (value: boolean) => {
    if (preview.current === value) return;
    preview.current = value;
    setPulling(value);
  };
  const enabled = !props.horizontal && props.scrollEnabled !== false;
  const refreshing = !!props.refreshing || app.refreshing;
  useEffect(() => {
    if (!visible || !enabled || refreshing) {
      start.current = undefined;
      preview.current = false;
      setPulling(false);
    }
  }, [visible, enabled, refreshing]);
  const refresh = () => {
    if (refreshing) return;
    if (props.onRefresh) props.onRefresh();
    else void app.refresh();
  };
  return {
    boundary: { enabled, refreshing, refresh, scrollY, pulling },
    scroll: {
      onTouchStart: (
        event: Parameters<NonNullable<ScrollViewProps["onTouchStart"]>>[0],
      ) => {
        const { pageX, pageY } = event.nativeEvent;
        start.current =
          Platform.OS !== "web" &&
          visible &&
          enabled &&
          !refreshing &&
          scrollY.current <= 1
            ? { x: pageX, y: pageY }
            : undefined;
        props.onTouchStart?.(event);
      },
      onTouchMove: (
        event: Parameters<NonNullable<ScrollViewProps["onTouchMove"]>>[0],
      ) => {
        const origin = start.current;
        if (origin)
          showPreview(
            pullDistance(
              event.nativeEvent.pageX - origin.x,
              event.nativeEvent.pageY - origin.y,
              scrollY.current,
            ) > 12,
          );
        props.onTouchMove?.(event);
      },
      onTouchEnd: (
        event: Parameters<NonNullable<ScrollViewProps["onTouchEnd"]>>[0],
      ) => {
        start.current = undefined;
        showPreview(false);
        props.onTouchEnd?.(event);
      },
      onTouchCancel: (
        event: Parameters<NonNullable<ScrollViewProps["onTouchCancel"]>>[0],
      ) => {
        start.current = undefined;
        showPreview(false);
        props.onTouchCancel?.(event);
      },
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
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
          />
        ) : undefined),
    },
  };
}
