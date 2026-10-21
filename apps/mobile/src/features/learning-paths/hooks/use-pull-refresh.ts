import { useCallback, useRef, useState } from "react";

export function usePullRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);
  const onRefresh = useCallback(() => {
    if (active.current) return;
    active.current = true;
    setRefreshing(true);
    void refresh()
      .catch(() => {})
      .finally(() => {
        active.current = false;
        setRefreshing(false);
      });
  }, [refresh]);
  return { refreshing, onRefresh };
}
