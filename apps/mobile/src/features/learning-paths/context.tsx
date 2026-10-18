import { createContext, useContext, useState, type ReactNode } from "react";
import type { LearningPath } from "./types";
import { initialPaths } from "./fixtures";
import type { NegotiationDraft } from "./negotiation";
const Context = createContext<{
  paths: LearningPath[];
  save: (path: LearningPath) => void;
  drafts: Record<string, NegotiationDraft>;
  saveDraft: (conversationId: string, draft: NegotiationDraft) => void;
} | null>(null);
export function PathsPreviewProvider({ children }: { children: ReactNode }) {
  const [paths, setPaths] = useState(initialPaths);
  const [drafts, setDrafts] = useState<Record<string, NegotiationDraft>>({});
  return (
    <Context.Provider
      value={{
        paths,
        drafts,
        saveDraft: (conversationId, draft) =>
          setDrafts((items) => ({ ...items, [conversationId]: draft })),
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
