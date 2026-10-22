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

function previewStatus(status: string): PreviewSession["status"] {
  if (status === "COMPLETED" || status === "DISPUTED") return status;
  return "CONFIRMED";
}

// Read-only compatibility for the room and report previews.
export function SessionsPreviewProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { paths } = usePathsPreview();
  const value = useMemo(
    () => ({
      sessions: paths
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
              status: previewStatus(path.status),
            })),
          ),
        ),
    }),
    [paths],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSessionsPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionsPreviewProvider missing");
  return value;
}
