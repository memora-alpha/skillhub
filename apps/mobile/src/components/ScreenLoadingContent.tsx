import { useEffect, type ReactNode } from "react";
import { Keyboard, View } from "react-native";

export function ScreenLoadingContent({
  waiting,
  children,
}: Readonly<{
  waiting: boolean;
  children: ReactNode;
}>) {
  useEffect(() => {
    if (waiting) Keyboard.dismiss();
  }, [waiting]);
  return (
    <View
      style={{ flex: 1, minHeight: 0, opacity: waiting ? 0 : 1 }}
      pointerEvents={waiting ? "none" : "auto"}
      aria-hidden={waiting}
      accessibilityElementsHidden={waiting}
      importantForAccessibility={waiting ? "no-hide-descendants" : "auto"}
    >
      {children}
    </View>
  );
}
