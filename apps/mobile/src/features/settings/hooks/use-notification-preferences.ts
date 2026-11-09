import { useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import {
  createNotificationPreferencesApi,
  type NotificationPreferences,
} from "../api/notification-preferences-api";

export function useNotificationPreferences() {
  const runtime = useConnections();
  const cache = useQueryClient();
  const flight = useRef(false);
  const api = useMemo(
    () => createNotificationPreferencesApi(runtime.call),
    [runtime.call],
  );
  const queryKey = [...runtime.key, "notification-preferences"];
  const query = useConnectionQuery(
    ["notification-preferences"],
    (signal) => api.read(signal),
    true,
    { refreshOnFocus: "stale" },
  );
  const mutation = useMutation({
    retry: false,
    mutationFn: async (patch: Partial<NotificationPreferences>) => {
      runtime.assertCurrent();
      if (flight.current) throw new AppError("protocol");
      flight.current = true;
      try {
        // A read started before Save must not replace the confirmed preferences.
        await cache.cancelQueries({ queryKey, exact: true });
        runtime.assertCurrent();
        const saved = await api.update(patch);
        runtime.assertCurrent();
        await cache.cancelQueries({ queryKey, exact: true });
        runtime.assertCurrent();
        cache.setQueryData(queryKey, saved);
        return saved;
      } finally {
        flight.current = false;
      }
    },
  });
  return { query, mutation, isCurrent: runtime.isCurrent };
}
