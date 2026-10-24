import type { Ref } from "react";
import {
  ScrollView,
  type ScrollViewProps,
  type ScrollViewInstance,
} from "react-native";
import { PullRefreshBoundary } from "./PullRefreshBoundary";
import { useScrollRefresh } from "./use-scroll-refresh";

export type RefreshableScrollView = ScrollViewInstance;
export function RefreshableScrollView(
  props: ScrollViewProps & {
    ref?: Ref<ScrollViewInstance>;
    refreshing?: boolean;
    onRefresh?: () => void;
  },
) {
  const refresh = useScrollRefresh(props);
  return (
    <PullRefreshBoundary {...refresh.boundary}>
      <ScrollView {...props} {...refresh.scroll} />
    </PullRefreshBoundary>
  );
}
