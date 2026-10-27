import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuthSession } from "@/features/auth";
import { useLearningPath, useLearningPaths } from "@/features/learning-paths";
import {
  useRequestList,
  type PublicRequest,
} from "@/features/learning-requests";
import { useConversationInbox } from "@/features/messages";
import {
  deviceTimezone,
  listIsLimited,
  useSessionList,
} from "@/features/sessions";
import { useQuietReadRecovery } from "@/lib/query/use-quiet-read-recovery";
import {
  homePathProgress,
  homeSessionRange,
  selectHomePathId,
  selectUpcomingSession,
} from "../utils/home-data";

export function useHomeData(focused: boolean) {
  const { session, runtime, status } = useAuthSession();
  const generation = runtime.controller.generation;
  const active = focused && status === "authenticated";
  const [rangeAnchor, setRangeAnchor] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const update = () => {
        const current = Date.now();
        setNow(current);
        setRangeAnchor((previous) =>
          current - previous >= 60_000 ? current : previous,
        );
      };
      update();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") update();
      });
      const timer = setInterval(() => {
        if (AppState.currentState === "active") setNow(Date.now());
      }, 30_000);
      return () => {
        clearInterval(timer);
        listener.remove();
      };
    }, [active]),
  );
  const sessions = useSessionList(
    homeSessionRange(rangeAnchor),
    deviceTimezone(),
    active,
  );
  const nextSession =
    active && !sessions.error
      ? selectUpcomingSession(sessions.data ?? [], now)
      : undefined;
  const paths = useLearningPaths(active);
  const pathId = selectHomePathId(
    nextSession,
    !sessions.isPending && !paths.error && active ? (paths.data ?? []) : [],
  );
  const path = useLearningPath(pathId ?? "", active && !!pathId);
  const currentPath = active && !path.error ? path.data : undefined;
  const requests = useRequestList("recommended", {}, active);
  const messages = useConversationInbox({ enabled: active, previewLimit: 3 });
  const isCurrent = () =>
    active &&
    runtime.controller.generation === generation &&
    runtime.controller.getSnapshot() === "ready";
  const refreshSessions = () => {
    if (isCurrent()) return sessions.refetch({ cancelRefetch: false });
  };
  const refreshPath = () => {
    if (!isCurrent()) return;
    return Promise.all([
      paths.refetch({ cancelRefetch: false }),
      ...(pathId ? [path.refetch({ cancelRefetch: false })] : []),
    ]);
  };
  const refreshRequests = () => {
    if (isCurrent()) return requests.refetch();
  };
  const refreshMessages = () => {
    if (isCurrent()) return messages.refetch();
  };
  useQuietReadRecovery({
    error: sessions.error,
    fetching: sessions.isFetching,
    enabled: active,
    retry: refreshSessions,
  });
  useQuietReadRecovery({
    error: path.error ?? paths.error,
    fetching: path.isFetching || paths.isFetching,
    enabled: active,
    retry: refreshPath,
  });
  useQuietReadRecovery({
    error: requests.error,
    fetching: requests.isFetching,
    enabled: active,
    retry: refreshRequests,
  });
  useQuietReadRecovery({
    error: messages.error,
    fetching: messages.isFetching,
    enabled: active,
    retry: refreshMessages,
  });
  const refresh = async () => {
    if (!isCurrent()) return;
    setNow(Date.now());
    return Promise.all([
      refreshSessions(),
      refreshPath(),
      refreshRequests(),
      refreshMessages(),
    ]);
  };
  return {
    sessions: {
      item: nextSession,
      loading: active && sessions.isPending,
      error: sessions.error,
      limited: listIsLimited(sessions.data ?? []),
      refetch: refreshSessions,
    },
    path: {
      item: currentPath,
      ...homePathProgress(currentPath, session?.userId ?? ""),
      loading:
        active &&
        (sessions.isPending ||
          (!pathId && paths.isPending) ||
          (!!pathId && path.isPending)),
      error: pathId ? path.error : paths.error,
      refetch: refreshPath,
    },
    requests: {
      items:
        active && !requests.error
          ? requests.items
              .filter((item): item is PublicRequest => "owner" in item)
              .slice(0, 2)
          : [],
      loading: active && requests.isPending,
      error: requests.error,
      refetch: refreshRequests,
    },
    messages: {
      items: active && !messages.error ? messages.items.slice(0, 3) : [],
      loading: active && messages.isPending,
      error: messages.error,
      refetch: refreshMessages,
    },
    refreshing:
      active &&
      (sessions.isRefetching ||
        paths.isRefetching ||
        (!!pathId && path.isRefetching) ||
        requests.isRefetching ||
        messages.isRefetching),
    refresh,
  };
}

export type HomeData = ReturnType<typeof useHomeData>;
