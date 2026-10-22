import type { Ref } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
import { PullRefreshBoundary } from "./PullRefreshBoundary";
import { useScrollRefresh } from "./use-scroll-refresh";

export type RefreshableScrollView = ScrollView;
export function RefreshableScrollView(
  props: ScrollViewProps & { ref?: Ref<ScrollView> },
) {
  const refresh = useScrollRefresh(props);
  return (
    <PullRefreshBoundary {...refresh.boundary}>
      <ScrollView {...props} {...refresh.scroll} />
    </PullRefreshBoundary>
  );
}
