import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathsPreview } from "@/features/learning-paths";
export type PreviewSession = {
  id: string;
  pathId: string;
  planId: string;
  title: string;
  partner: string;
  startAt: string;
  duration: number;
  status: "CONFIRMED" | "AWAITING_CONFIRMATION" | "COMPLETED" | "DISPUTED";
  mine: boolean;
  meConfirmed?: boolean;
  partnerConfirmed?: boolean;
  change?: {
    startAt: string;
    duration: number;
    reason: string;
    version: number;
    meConfirmed: boolean;
    partnerConfirmed: boolean;
    requestedBy?: "me" | "partner";
    applied?: boolean;
  };
};
const Context = createContext<{
  sessions: PreviewSession[];
  save: (s: PreviewSession) => void;
  confirm: (id: string) => void;
  confirmChange: (id: string) => string | undefined;
} | null>(null);
export function SessionsPreviewProvider({ children }: { children: ReactNode }) {
  const { paths, save: savePath } = usePathsPreview();
  const [anchor] = useState(Date.now());
  const [overrides, setOverrides] = useState<Record<string, PreviewSession>>(
    {},
  );
  const sessions = useMemo(
    () =>
      paths
        .filter((p) => ["ACTIVE", "COMPLETED", "DISPUTED"].includes(p.status))
        .flatMap((path) =>
          path.plans.flatMap((plan) =>
            (plan.schedule?.slots ?? []).map((slot, i): PreviewSession => {
              const id = `${plan.id}-${i}`;
              const endedFixture =
                ["path-active", "path-awaiting"].includes(path.id) && i === 0;
              return (
                overrides[id] ?? {
                  id,
                  pathId: path.id,
                  planId: plan.id,
                  title: `${plan.skill} · Buổi ${i + 1}: ${plan.outline[i]}`,
                  partner: path.partner,
                  startAt: endedFixture
                    ? new Date(anchor - 3 * 60 * 60000).toISOString()
                    : slot.startAt,
                  duration: slot.duration,
                  mine: plan.teacher === "me",
                  status:
                    path.status === "COMPLETED"
                      ? "COMPLETED"
                      : path.status === "DISPUTED"
                        ? "DISPUTED"
                        : endedFixture
                          ? "AWAITING_CONFIRMATION"
                          : "CONFIRMED",
                  partnerConfirmed:
                    (endedFixture && path.id === "path-active") ||
                    path.status === "COMPLETED",
                  meConfirmed: path.status === "COMPLETED",
                  change:
                    path.id === "path-active" && i === 1
                      ? {
                          startAt: new Date(
                            Date.parse(slot.startAt) + 86400000,
                          ).toISOString(),
                          duration: 90,
                          reason:
                            "Đối tác đề nghị chuyển sang ngày kế tiếp trong kịch bản mẫu.",
                          version: 1,
                          meConfirmed: false,
                          partnerConfirmed: true,
                          requestedBy: "partner",
                        }
                      : undefined,
                }
              );
            }),
          ),
        ),
    [paths, overrides, anchor],
  );
  const save = (s: PreviewSession) =>
    setOverrides((v) => ({ ...v, [s.id]: s }));
  const confirm = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (
      !session ||
      session.meConfirmed ||
      session.status !== "AWAITING_CONFIRMATION" ||
      Date.now() < Date.parse(session.startAt) + session.duration * 60000
    )
      return;
    const complete = session.partnerConfirmed;
    save({
      ...session,
      meConfirmed: true,
      status: complete ? "COMPLETED" : "AWAITING_CONFIRMATION",
    });
    const path = paths.find((p) => p.id === session.pathId);
    if (complete && path)
      savePath({ ...path, completedSessions: path.completedSessions + 1 });
  };
  const confirmChange = (id: string) => {
    const s = sessions.find((item) => item.id === id);
    if (!s?.change || s.change.applied || s.status !== "CONFIRMED")
      return "Đề nghị không còn hợp lệ.";
    if (Date.parse(s.startAt) - Date.now() < 3600000)
      return "Đã qua hạn chốt đổi lịch; lịch cũ giữ nguyên.";
    if (Date.parse(s.change.startAt) <= Date.now())
      return "Ngày giờ đề nghị không còn trong tương lai.";
    if (
      sessions.some(
        (other) =>
          other.id !== id &&
          ["CONFIRMED", "DISPUTED"].includes(other.status) &&
          Date.parse(s.change!.startAt) <
            Date.parse(other.startAt) + other.duration * 60000 &&
          Date.parse(s.change!.startAt) + s.change!.duration * 60000 >
            Date.parse(other.startAt),
      )
    )
      return "Lịch mới bị trùng buổi học khác; lịch cũ giữ nguyên.";
    const change = { ...s.change, meConfirmed: true };
    save(
      change.partnerConfirmed
        ? {
            ...s,
            startAt: change.startAt,
            duration: change.duration,
            change: { ...change, applied: true },
          }
        : { ...s, change },
    );
  };
  return (
    <Context.Provider value={{ sessions, save, confirm, confirmChange }}>
      {children}
    </Context.Provider>
  );
}
export function useSessionsPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionsPreviewProvider missing");
  return value;
}
