import Toast, { type ToastProps } from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SafeAreaToast(props: Omit<ToastProps, "topOffset">) {
  const insets = useSafeAreaInsets();
  return <Toast {...props} topOffset={insets.top + 12} />;
}
