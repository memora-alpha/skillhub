import { createContext, useContext, useState, type ReactNode } from "react";
import type { LearningPath } from "./types";
import { initialPaths } from "./fixtures";
const Context = createContext<{
  paths: LearningPath[];
  save: (path: LearningPath) => void;
} | null>(null);
export function PathsPreviewProvider({ children }: { children: ReactNode }) {
  const [paths, setPaths] = useState(initialPaths);
  return (
    <Context.Provider
      value={{
        paths,
        save: (path) =>
          setPaths((items) => [path, ...items.filter((p) => p.id !== path.id)]),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePathsPreview() {
  const v = useContext(Context);
  if (!v) throw new Error("PathsPreviewProvider missing");
  return v;
}
