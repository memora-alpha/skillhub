import { createContext, useContext, type ReactNode } from "react";
import { useIsFocused } from "expo-router";

const Visibility = createContext(true);

export function LoadingScreenBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const focused = useIsFocused();
  return <Visibility.Provider value={focused}>{children}</Visibility.Provider>;
}

// Startup/session gates have no navigation context yet, so they use the default.
export function useLoadingVisible() {
  return useContext(Visibility);
}
