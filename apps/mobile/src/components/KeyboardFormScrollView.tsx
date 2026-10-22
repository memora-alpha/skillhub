import { Platform, type ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { RefreshableScrollView } from "./RefreshableScrollView";
import { useScrollRefresh } from "./use-scroll-refresh";

export function KeyboardFormScrollView(props: ScrollViewProps) {
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
    <KeyboardAwareScrollView
      {...common}
      {...props}
      {...refresh.scroll}
      mode="insets"
      bottomOffset={32}
    />
  );
}
