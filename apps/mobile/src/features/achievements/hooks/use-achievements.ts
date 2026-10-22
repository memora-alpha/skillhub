import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth";
import type { OwnIdentity } from "@/features/account";
import { AppError } from "@/lib/http/errors";
import {
  createAchievementsApi,
  type Achievements,
} from "../api/achievements-api";

export function useAchievements() {
  const { runtime, session, status } = useAuthSession();
  const generation = runtime.controller.generation;
  const client = useQueryClient();
  const flight = useRef(false);
  const queryKey = useMemo(
    () => ["achievements", session?.userId, generation] as const,
    [session?.userId, generation],
  );
  const isCurrent = useCallback(
    () =>
      runtime.controller.generation === generation &&
      runtime.controller.getSnapshot() === "ready",
    [runtime, generation],
  );
  const api = useMemo(
    () => createAchievementsApi(runtime.client, isCurrent),
    [runtime.client, isCurrent],
  );
  const enabled = status === "authenticated";
  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      try {
        return await api.mine(signal);
      } catch (error) {
        // Replace private data on denial, including on later failed refreshes.
        if (error instanceof AppError && error.status === 403) return null;
        throw error;
      }
    },
  });
  useEffect(() => {
    if (!enabled || !query.data || !isCurrent()) return;
    const selectedTitle = query.data.selectedTitle;
    client.setQueryData<OwnIdentity>(
      ["account", "me", generation],
      (current) =>
        current &&
        current.userId === session?.userId &&
        current.profile.selectedTitle !== selectedTitle
          ? { ...current, profile: { ...current.profile, selectedTitle } }
          : current,
    );
  }, [client, enabled, generation, isCurrent, query.data, session?.userId]);
  const mutation = useMutation({
    mutationFn: async (code: string | null) => {
      if (flight.current || !isCurrent()) throw new AppError("session");
      flight.current = true;
      try {
        // Prevent older reads from overwriting the selection returned by PATCH.
        await client.cancelQueries({ queryKey });
        await client.cancelQueries({ queryKey: ["account", "me", generation] });
        const result = await api.selectTitle(code);
        if (!isCurrent()) throw new AppError("session");
        client.setQueryData<Achievements | null>(queryKey, (current) =>
          current ? { ...current, ...result } : current,
        );
        client.setQueryData<OwnIdentity>(
          ["account", "me", generation],
          (current) =>
            current && current.userId === session?.userId
              ? { ...current, profile: { ...current.profile, ...result } }
              : current,
        );
        void client.invalidateQueries({
          queryKey: ["public-profile", session?.userId, generation],
        });
        return result;
      } finally {
        flight.current = false;
      }
    },
    onSettled: () => {
      if (isCurrent()) void client.invalidateQueries({ queryKey });
    },
  });
  const visited = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (visited.current && !flight.current) void query.refetch();
      visited.current = true;
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active" && !flight.current) void query.refetch();
      });
      return () => listener.remove();
    }, [enabled, query.refetch]),
  );
  useEffect(
    () => () => {
      void client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
    },
    [client, queryKey],
  );
  return {
    query,
    mutation,
    enabled,
    data: enabled && isCurrent() ? query.data : undefined,
  };
}
