import { createContext, useContext, type ReactNode } from "react";
import type { LearningPath } from "./types";
import { initialPaths } from "./fixtures";
const previewValue = { paths: initialPaths };
const Context = createContext<Readonly<{
  paths: readonly LearningPath[];
}> | null>(null);
export function PathsPreviewProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={previewValue}>{children}</Context.Provider>;
}
export function usePathsPreview() {
  const v = useContext(Context);
  if (!v) throw new Error("PathsPreviewProvider missing");
  return v;
}
