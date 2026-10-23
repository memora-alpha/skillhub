import type { Ref } from "react";
import { FlatList, type FlatListProps } from "react-native";
import { PullRefreshBoundary } from "./PullRefreshBoundary";
import { useScrollRefresh } from "./use-scroll-refresh";

export type RefreshableFlatList<Item> = FlatList<Item>;
type ListComponent =
  "ListEmptyComponent" | "ListHeaderComponent" | "ListFooterComponent";
type RefreshableFlatListProps<Item> = Omit<
  FlatListProps<Item>,
  ListComponent
> & {
  [Key in ListComponent]?: FlatListProps<Item>[Key] | null;
} & { ref?: Ref<FlatList<Item>> };

export function RefreshableFlatList<Item>(
  props: RefreshableFlatListProps<Item>,
) {
  const refresh = useScrollRefresh(props);
  return (
    <PullRefreshBoundary {...refresh.boundary}>
      <FlatList
        {...props}
        {...refresh.scroll}
        ListEmptyComponent={props.ListEmptyComponent ?? undefined}
        ListHeaderComponent={props.ListHeaderComponent ?? undefined}
        ListFooterComponent={props.ListFooterComponent ?? undefined}
      />
    </PullRefreshBoundary>
  );
}
