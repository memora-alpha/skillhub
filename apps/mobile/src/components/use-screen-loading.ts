import { createContext, useContext, useLayoutEffect, useRef } from "react";
import type { ScreenLoadingStore } from "./screen-loading-store";

export type LoadingPresentation =
  "screen" | "inline" | "placeholder" | "silent";
export const ScreenLoadingContext = createContext<ScreenLoadingStore | null>(
  null,
);

export function useScreenLoading(
  presentation: LoadingPresentation,
  busy: boolean,
  label: string,
) {
  const store = useContext(ScreenLoadingContext);
  const id = useRef(Symbol("screen-read"));
  useLayoutEffect(() => {
    if (store && presentation === "screen" && busy)
      return store.register(id.current, label);
  }, [store, presentation, busy, label]);
  return store !== null && presentation === "screen";
}
