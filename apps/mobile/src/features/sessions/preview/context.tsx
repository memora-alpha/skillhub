import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathsPreview } from "@/features/learning-paths/state";

type PreviewSession = {
  id: string;
  pathId: string;
  title: string;
  partner: string;
  status: "CONFIRMED" | "COMPLETED" | "DISPUTED";
};
const Context = createContext<{ sessions: PreviewSession[] } | null>(null);

// Read-only compatibility for the room and report previews.
export function SessionsPreviewProvider({ children }: { children: ReactNode }) {
  const { paths } = usePathsPreview();
  const sessions = useMemo(
    () =>
      paths
        .filter((path) =>
          ["ACTIVE", "COMPLETED", "DISPUTED"].includes(path.status),
        )
        .flatMap((path) =>
          path.plans.flatMap((plan) =>
            (plan.schedule?.slots ?? []).map((_, index): PreviewSession => ({
              id: `${plan.id}-${index}`,
              pathId: path.id,
              title: `${plan.skill} · Buổi ${index + 1}: ${plan.outline[index]}`,
              partner: path.partner,
              status:
                path.status === "COMPLETED"
                  ? "COMPLETED"
                  : path.status === "DISPUTED"
                    ? "DISPUTED"
                    : "CONFIRMED",
            })),
          ),
        ),
    [paths],
  );
  return <Context.Provider value={{ sessions }}>{children}</Context.Provider>;
}

export function useSessionsPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionsPreviewProvider missing");
  return value;
}
