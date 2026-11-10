import type { PathSummary } from "../api/learning-paths-contract";

export const pathListFilters = [
  { value: "all", label: "Tất cả" },
  { value: "negotiating", label: "Đang trao đổi" },
  { value: "waiting", label: "Chờ bắt đầu" },
  { value: "learning", label: "Đang học" },
  { value: "settling", label: "Chờ quyết toán" },
  { value: "completed", label: "Hoàn thành" },
  { value: "stopped", label: "Đã dừng" },
  { value: "disputed", label: "Tranh chấp" },
] as const;
export type PathListFilter = (typeof pathListFilters)[number]["value"];
type PathListGroup = Exclude<PathListFilter, "all">;

const stageGroups: Record<
  NonNullable<PathSummary["learningStage"]>,
  PathListGroup
> = {
  PREPARING: "negotiating",
  WAITING_START: "waiting",
  LEARNING: "learning",
  LEARNING_FINISHED: "settling",
  COMPLETED: "completed",
  STOPPED: "stopped",
};
const statusGroups: Record<PathSummary["status"], PathListGroup> = {
  DRAFT: "negotiating",
  PROPOSED: "negotiating",
  PARTIALLY_CONFIRMED: "negotiating",
  CONFIRMED: "negotiating",
  SCHEDULED: "waiting",
  ACTIVE: "learning",
  COMPLETED: "completed",
  CANCELLED: "stopped",
  DISPUTED: "disputed",
};

function pathListGroup(path: PathSummary): PathListGroup {
  // A disputed path can still have a learning stage; keep its explicit status
  // discoverable rather than presenting it as a completed or stopped path.
  if (path.status === "DISPUTED") return "disputed";
  return path.learningStage
    ? stageGroups[path.learningStage]
    : statusGroups[path.status];
}
export function filterPathSummaries(
  paths: readonly PathSummary[],
  filter: PathListFilter,
) {
  return paths.filter(
    (path) => filter === "all" || pathListGroup(path) === filter,
  );
}
