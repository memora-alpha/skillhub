import type { PathSummary } from "../api/learning-paths-contract";

export const pathListFilters = [
  { value: "all", label: "Tất cả" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "negotiating", label: "Đang trao đổi" },
] as const;
export type PathListFilter = (typeof pathListFilters)[number]["value"];
export function filterPathSummaries(
  paths: readonly PathSummary[],
  filter: PathListFilter,
) {
  return paths.filter(
    (path) =>
      filter === "all" ||
      (filter === "confirmed"
        ? path.status === "CONFIRMED"
        : ["DRAFT", "PROPOSED", "PARTIALLY_CONFIRMED"].includes(path.status)),
  );
}
