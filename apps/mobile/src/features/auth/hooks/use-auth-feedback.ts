import { useEffect, useRef } from "react";
import { useToast } from "@/providers/ToastProvider";

export function useAuthFeedback(message: string | null) {
  const { showToast } = useToast();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!message || shown.current === message) return;
    shown.current = message;
    showToast(message, "success");
  }, [message, showToast]);
}
