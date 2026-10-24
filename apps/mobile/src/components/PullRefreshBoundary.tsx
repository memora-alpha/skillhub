import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Text, View, type ViewInstance } from "react-native";
import { appColors, fonts } from "@/constants/theme";
import { pullDistance, pullThreshold } from "@/utils/pull-refresh";
import { LoadingIndicator } from "./LoadingIndicator";

export function PullRefreshBoundary({
  children,
  enabled,
  refreshing,
  refresh,
  scrollY,
  pulling = false,
}: Readonly<{
  children: ReactNode;
  enabled: boolean;
  refreshing: boolean;
  refresh: () => void;
  scrollY: { current: number };
  pulling?: boolean;
}>) {
  const frame = useRef<ViewInstance>(null);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  const [pull, setPull] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;
    const node = frame.current as unknown as HTMLElement | null;
    if (!node) return;
    let start: { x: number; y: number } | undefined;
    let distance = 0;
    let stage = 0;
    const begin = (x: number, y: number, target: EventTarget | null) => {
      const input =
        target instanceof Element &&
        target.closest("input,textarea,[contenteditable=true]");
      start =
        !input && scrollY.current <= 1 && !refreshing ? { x, y } : undefined;
      distance = 0;
    };
    const move = (x: number, y: number) => {
      if (!start || refreshing) return false;
      distance = pullDistance(x - start.x, y - start.y, scrollY.current);
      if (distance <= 12) {
        if (stage !== 0) {
          stage = 0;
          setPull(0);
        }
        return false;
      }
      const nextStage = distance >= pullThreshold ? pullThreshold : 13;
      if (stage !== nextStage) {
        stage = nextStage;
        setPull(nextStage);
      }
      return true;
    };
    const cancel = () => {
      start = undefined;
      distance = 0;
      stage = 0;
      setPull(0);
    };
    const end = () => {
      const ready = distance >= pullThreshold;
      cancel();
      if (ready && !refreshing) latestRefresh.current();
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.button === 0)
        begin(event.pageX, event.pageY, event.target);
    };
    const drag = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (move(event.pageX, event.pageY)) {
        event.preventDefault();
        node.setPointerCapture(event.pointerId);
        window.getSelection()?.removeAllRanges();
      }
    };
    const release = (event: PointerEvent) => {
      if (event.pointerType !== "touch") end();
    };
    const touchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length === 1 && touch)
        begin(touch.pageX, touch.pageY, event.target);
      else cancel();
    };
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch && move(touch.pageX, touch.pageY)) event.preventDefault();
    };
    const options = { capture: true, passive: false };
    node.addEventListener("pointerdown", down, options);
    node.addEventListener("pointermove", drag, options);
    node.addEventListener("pointerup", release, options);
    node.addEventListener("pointercancel", cancel, options);
    node.addEventListener("touchstart", touchStart, options);
    node.addEventListener("touchmove", touchMove, options);
    node.addEventListener("touchend", end, options);
    node.addEventListener("touchcancel", cancel, options);
    return () => {
      node.removeEventListener("pointerdown", down, options);
      node.removeEventListener("pointermove", drag, options);
      node.removeEventListener("pointerup", release, options);
      node.removeEventListener("pointercancel", cancel, options);
      node.removeEventListener("touchstart", touchStart, options);
      node.removeEventListener("touchmove", touchMove, options);
      node.removeEventListener("touchend", end, options);
      node.removeEventListener("touchcancel", cancel, options);
    };
  }, [enabled, refreshing, scrollY]);
  if (Platform.OS !== "web")
    return (
      <View style={{ flex: 1, minHeight: 0 }}>
        {children}
        {enabled && (refreshing || pulling) && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 8,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <LoadingIndicator
              accessibilityLabel={
                refreshing ? "Đang làm mới dữ liệu" : "Kéo xuống để làm mới"
              }
              animating={refreshing}
              busy={refreshing}
            />
          </View>
        )}
      </View>
    );
  if (!enabled) return children;
  let label = "Kéo xuống để làm mới";
  if (refreshing) label = "Đang làm mới…";
  else if (pull >= pullThreshold) label = "Thả để làm mới";
  return (
    <View ref={frame} style={{ flex: 1, minHeight: 0 }}>
      {(refreshing || pull > 12) && (
        <View
          accessibilityLiveRegion="polite"
          style={{ alignItems: "center", padding: 10, gap: 4 }}
        >
          <LoadingIndicator
            accessibilityLabel={label}
            animating={refreshing}
            busy={refreshing}
          />
          <Text style={{ fontFamily: fonts.body, color: appColors.muted }}>
            {label}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}
