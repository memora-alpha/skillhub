import { useRouter, type Href } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
export function useRequestBack(fallback: Href, pending = false) {
  const router = useRouter();
  usePreventRemove(pending, () => {
    /* Keep the form mounted until the request completes. */
  });
  return () => {
    if (pending) return;
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
}
