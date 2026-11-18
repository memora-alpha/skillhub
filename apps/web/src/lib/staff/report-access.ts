export function isSystemReport(report: unknown): boolean {
  if (!report || typeof report !== "object") return false;
  return (
    ("source" in report && report.source === "SYSTEM") ||
    ("reporterId" in report && report.reporterId === null)
  );
}

export function assertReportEditable(report: unknown): void {
  if (isSystemReport(report))
    throw new Error("Báo cáo do hệ thống ghi nhận chỉ cho phép xem.");
}
