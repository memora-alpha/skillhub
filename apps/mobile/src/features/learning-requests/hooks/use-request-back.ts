import { useRouter, usePreventRemove, type Href } from "expo-router";
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
