import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { LearningSession } from "../types";
import { sessionEarlyJoinMs } from "../utils/session-join";

export function useSessionClock(
  session?: Pick<LearningSession, "startAt" | "endAt" | "join">,
  onBoundary?: () => void,
) {
  const [now, setNow] = useState(Date.now);
  const focused = useRef(false);
  const onBoundaryRef = useRef(onBoundary);
  onBoundaryRef.current = onBoundary;
  const start = session?.startAt;
  const end = session?.endAt;
  const opens = session?.join?.opensAt;
  const closes = session?.join?.closesAt;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const boundaries = [
      Date.parse(start ?? "") - 60 * 60_000 + 1,
      Date.parse(start ?? "") - sessionEarlyJoinMs,
      Date.parse(start ?? ""),
      Date.parse(end ?? ""),
      Date.parse(opens ?? ""),
      Date.parse(closes ?? ""),
    ].filter(Number.isFinite);
    const refresh = (boundary = false) => {
      if (timer) clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      if (boundary && focused.current && AppState.currentState === "active")
        onBoundaryRef.current?.();
      const next = Math.min(...boundaries.filter((value) => value > current));
      if (Number.isFinite(next))
        timer = setTimeout(
          () => refresh(Date.now() >= next),
          Math.min(next - current, 2_147_483_647),
        );
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [start, end, opens, closes]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setNow(Date.now());
      return () => {
        focused.current = false;
      };
    }, []),
  );
  return now;
}
