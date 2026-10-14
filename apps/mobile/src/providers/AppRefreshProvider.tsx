import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createReadRefresh } from "@/lib/query/refresh-active-reads";

const Context = createContext<{
  refreshing: boolean;
  refresh: () => Promise<void>;
} | null>(null);

export function AppRefreshProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const read = useMemo(() => createReadRefresh(client), [client]);
  const value = useMemo(
    () => ({
      refreshing,
      refresh: async () => {
        setRefreshing(true);
        try {
          await read();
        } finally {
          setRefreshing(false);
        }
      },
    }),
    [read, refreshing],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppRefresh() {
  const value = useContext(Context);
  if (!value) throw new Error("AppRefreshProvider is required");
  return value;
}
