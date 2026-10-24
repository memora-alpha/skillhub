import { Platform, type ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { RefreshableScrollView } from "./RefreshableScrollView";
import { useScrollRefresh } from "./use-scroll-refresh";
import { PullRefreshBoundary } from "./PullRefreshBoundary";

export function KeyboardFormScrollView(
  props: ScrollViewProps & { refreshing?: boolean; onRefresh?: () => void },
) {
  const refresh = useScrollRefresh(props);
  const common = {
    keyboardShouldPersistTaps: "handled" as const,
    keyboardDismissMode:
      Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const),
    showsVerticalScrollIndicator: false,
  };
  if (Platform.OS === "web")
    return <RefreshableScrollView {...common} {...props} />;
  return (
    <PullRefreshBoundary {...refresh.boundary}>
      <KeyboardAwareScrollView
        {...common}
        {...props}
        {...refresh.scroll}
        mode="insets"
        bottomOffset={32}
      />
    </PullRefreshBoundary>
  );
}
