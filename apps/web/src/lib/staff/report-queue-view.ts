export type ReportQueueView = "actionable" | "all";
export const openReportStatuses = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"];

export function reportQueueParams(input: {
  view: ReportQueueView;
  status: string;
  severity: string;
  source: string;
  handlerId?: string;
  contentReview?: string;
}) {
  const params = new URLSearchParams({ limit: "20" });
  if (input.severity) params.set("severity", input.severity);
  if (input.handlerId) params.set("handlerId", input.handlerId);
  if (input.contentReview) params.set("contentReview", input.contentReview);
  if (input.view === "actionable") {
    params.set("source", "USER");
    if (openReportStatuses.includes(input.status))
      params.set("status", input.status);
  } else {
    params.set("status", input.status || "ALL");
    if (input.source) params.set("source", input.source);
  }
  return params;
}

export function reportMatchesView(
  row: { source?: string; status: string },
  view: ReportQueueView,
) {
  return (
    view === "all" ||
    (row.source === "USER" && openReportStatuses.includes(row.status))
  );
}
