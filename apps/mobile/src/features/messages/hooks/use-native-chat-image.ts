import { useEffect, useRef, useState } from "react";
import { Image } from "react-native";

export const NATIVE_CHAT_IMAGE_TIMEOUT_MS = 10_000;

// The zoom library does not expose onError. Validate its local source first.
export function useNativeChatImage(
  uri: string | undefined,
  enabled: boolean,
  onError?: () => void,
) {
  const [result, setResult] = useState<{ uri: string; error?: string }>();
  const failure = useRef(onError);
  failure.current = onError;
  useEffect(() => {
    if (!uri || !enabled) return;
    let active = true;
    const fail = () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      setResult({ uri, error: "Không đọc được ảnh." });
      failure.current?.();
    };
    const timer = setTimeout(fail, NATIVE_CHAT_IMAGE_TIMEOUT_MS);
    try {
      Image.getSize(
        uri,
        (width, height) => {
          if (!active) return;
          if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
          ) {
            fail();
            return;
          }
          active = false;
          clearTimeout(timer);
          setResult({ uri });
        },
        fail,
      );
    } catch {
      fail();
    }
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [uri, enabled]);
  const current = !!uri && enabled && result?.uri === uri;
  return {
    ready: current && !result.error,
    error: current ? result.error : undefined,
  };
}
