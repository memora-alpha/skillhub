import Toast, { type ToastProps } from "react-native-toast-message";
import { toastTheme } from "@/constants/theme";
import { safeAreaInset } from "@/utils/web-safe-area";

export function SafeAreaToast(props: Omit<ToastProps, "topOffset">) {
  return (
    <div
      data-safe-area-toast
      style={{
        position: "fixed",
        top: safeAreaInset("top"),
        left: `calc(${safeAreaInset("left")} + ${toastTheme.gutter}px)`,
        right: `calc(${safeAreaInset("right")} + ${toastTheme.gutter}px)`,
        height: 0,
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      <Toast {...props} topOffset={12} />
    </div>
  );
}
