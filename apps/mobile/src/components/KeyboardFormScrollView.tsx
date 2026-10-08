import { Platform, ScrollView, type ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export function KeyboardFormScrollView(props: ScrollViewProps) {
  const common = {
    keyboardShouldPersistTaps: "handled" as const,
    keyboardDismissMode:
      Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const),
    showsVerticalScrollIndicator: false,
  };
  if (Platform.OS === "web") return <ScrollView {...common} {...props} />;
  return (
    <KeyboardAwareScrollView
      {...common}
      {...props}
      mode="insets"
      bottomOffset={32}
    />
  );
}
