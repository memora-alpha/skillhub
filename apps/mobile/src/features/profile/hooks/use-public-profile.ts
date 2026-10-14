import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import { createPublicProfileApi } from "../api/public-profile-api";

export function usePublicProfile(userId: string) {
  const { runtime, session, status } = useAuthSession();
  const generation = runtime.controller.generation;
  const client = useQueryClient();
  const queryKey = useMemo(
    () => ["public-profile", session?.userId, generation, userId] as const,
    [session?.userId, generation, userId],
  );
  const api = useMemo(
    () =>
      createPublicProfileApi(
        runtime.client,
        () =>
          runtime.controller.generation === generation &&
          runtime.controller.getSnapshot() === "ready",
      ),
    [runtime, generation],
  );
  const enabled = status === "authenticated";
  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => api.get(userId, signal),
  });
  const visited = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (visited.current) void query.refetch();
      visited.current = true;
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void query.refetch();
      });
      return () => subscription.remove();
    }, [enabled, query.refetch]),
  );
  useEffect(
    () => () => {
      void client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
    },
    [client, queryKey],
  );
  return query;
}
