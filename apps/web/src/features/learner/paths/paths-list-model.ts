import type { PathSummary } from "../types";
import type { PathOverview } from "./path-overview";

// The mine endpoint contains the card projection, not the overview attention list.
export type PathListItem = PathSummary &
  Pick<
    PathOverview,
    "learningStage" | "progress" | "nextSession" | "attentionCount"
  > & {
    title: string | null;
  };

export const pathFilters = [
  ["all", "Tất cả"],
  ["active", "Đang thực hiện"],
  ["attention", "Cần theo dõi"],
  ["ended", "Đã kết thúc"],
] as const;
export type PathFilter = (typeof pathFilters)[number][0];

function searchText(value: string) {
  return value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
}

export function matchesPath(
  path: PathListItem,
  filter: PathFilter,
  keyword: string,
  counterpartName?: string,
) {
  const stage = path.learningStage;
  const matchesFilter =
    filter === "all" ||
    (filter === "active" &&
      ["PREPARING", "WAITING_START", "LEARNING", "LEARNING_FINISHED"].includes(
        stage ?? "",
      )) ||
    (filter === "attention" && path.attentionCount > 0) ||
    (filter === "ended" && (stage === "COMPLETED" || stage === "STOPPED"));
  const term = searchText(keyword);
  return (
    matchesFilter &&
    (!term ||
      searchText(path.title ?? "").includes(term) ||
      searchText(counterpartName ?? "").includes(term))
  );
}
