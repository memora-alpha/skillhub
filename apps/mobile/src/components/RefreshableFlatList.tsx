import type { Ref } from "react";
import { FlatList, type FlatListProps } from "react-native";
import { PullRefreshBoundary } from "./PullRefreshBoundary";
import { useScrollRefresh } from "./use-scroll-refresh";

export type RefreshableFlatList<Item> = FlatList<Item>;
export function RefreshableFlatList<Item>(
  props: FlatListProps<Item> & { ref?: Ref<FlatList<Item>> },
) {
  const refresh = useScrollRefresh(props);
  return (
    <PullRefreshBoundary {...refresh.boundary}>
      <FlatList {...props} {...refresh.scroll} />
    </PullRefreshBoundary>
  );
}
