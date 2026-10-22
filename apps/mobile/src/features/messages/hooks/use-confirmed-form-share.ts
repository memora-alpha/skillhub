import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { useMessagesApi } from "./use-messages-api";
import {
  createFormDelivery,
  type FormDelivery,
} from "../utils/confirmed-form-delivery";

export function useConfirmedFormShare() {
  const runtime = useConnections(),
    cache = useQueryClient(),
    api = useMessagesApi();
  const key = [...runtime.key, "confirmed-form-deliveries"];
  const query = useQuery<FormDelivery[]>({
    queryKey: key,
    // Cache-only queue: there is no endpoint to fetch or mutation to replay.
    queryFn: skipToken,
    initialData: [],
    enabled: false,
    gcTime: Infinity,
  });
  const transport = createFormDelivery({
    api,
    isCurrent: runtime.isCurrent,
    read: () => cache.getQueryData<FormDelivery[]>(key) ?? [],
    write: (items) => cache.setQueryData(key, items),
    refresh: (id) => {
      void cache.invalidateQueries({
        queryKey: [...runtime.key, "thread", id],
      });
      void cache.invalidateQueries({
        queryKey: [...runtime.key, "conversations", "preview", id],
      });
    },
  });
  return { ...transport, pending: query.data ?? [] };
}
