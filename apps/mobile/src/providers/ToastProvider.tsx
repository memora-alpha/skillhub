import { createContext, useContext, type ReactNode } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Toast, { type ToastConfig } from "react-native-toast-message";
import { ToastContent, type ToastTone } from "@/components/Toast";
import { SafeAreaToast } from "@/components/SafeAreaToast";

const actions = {
  showToast(message: string, tone: ToastTone = "info") {
    if (!message.trim()) return;
    Toast.show({
      type: tone,
      text1: message,
      visibilityTime: tone === "error" ? 7000 : 5000,
    });
  },
  dismissToast() {
    Toast.hide();
  },
};
const ToastContext = createContext<typeof actions | null>(null);
const config: ToastConfig = {
  success: ({ text1, hide, isVisible }) => (
    <ToastContent
      message={text1 ?? ""}
      tone="success"
      visible={isVisible}
      onDismiss={hide}
    />
  ),
  error: ({ text1, hide, isVisible }) => (
    <ToastContent
      message={text1 ?? ""}
      tone="error"
      visible={isVisible}
      onDismiss={hide}
    />
  ),
  info: ({ text1, hide, isVisible }) => (
    <ToastContent
      message={text1 ?? ""}
      tone="info"
      visible={isVisible}
      onDismiss={hide}
    />
  ),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <ToastContext.Provider value={actions}>
      {children}
      <SafeAreaToast
        config={config}
        position="top"
        animationConfig={{ type: "timing", duration: reducedMotion ? 0 : 200 }}
        onShow={({ text1 }) => {
          if (text1 && Platform.OS !== "web")
            AccessibilityInfo.announceForAccessibility(text1);
        }}
      />
    </ToastContext.Provider>
  );
}
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("ToastProvider is required");
  return toast;
}
