import { systemCodeLabel } from "@/lib/system-text";
import type { ReportCaseDetail } from "@/lib/staff/types";
import { Badge, Card } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";

const labels: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng mặt",
  UNVERIFIABLE: "Chưa xác minh được",
  BOTH_PRESENT: "Cả hai có mặt",
  TEACHER_ABSENT: "Người dạy vắng mặt",
  LEARNER_ABSENT: "Người học vắng mặt",
  BOTH_ABSENT: "Cả hai vắng mặt",
};
export function AttendanceEvidence({
  outcome,
}: Readonly<{ outcome: ReportCaseDetail["attendanceOutcome"] }>) {
  if (!outcome) return null;
  return (
    <Card title="Bằng chứng điểm danh">
      <div className="ops-attendance-grid">
        {(
          [
            [
              "Người dạy",
              outcome.teacherVerdict,
              outcome.teacherSeconds,
              outcome.teacherLate,
            ],
            [
              "Người học",
              outcome.learnerVerdict,
              outcome.learnerSeconds,
              outcome.learnerLate,
            ],
          ] as const
        ).map(([role, verdict, seconds, late]) => (
          <div className="ops-attendance-person" key={role}>
            <span>{role}</span>
            <strong>{durationText(seconds)}</strong>
            <Badge tone={verdict === "PRESENT" ? "ok" : "warn"}>
              {labels[verdict] ?? "Chưa đủ dữ liệu"}
            </Badge>
            {late && <small>Có ghi nhận vào muộn</small>}
          </div>
        ))}
      </div>
      <p className="muted">
        Thời lượng là dữ liệu hỗ trợ. Kết quả xử lý cần được xem xét cùng bằng
        chứng.
      </p>
      <details className="ops-case-identifiers">
        <summary>Chi tiết kết quả điểm danh</summary>
        <dl className="kv staff-kv ops-attendance-meta">
          <dt>Kết luận</dt>
          <dd>
            {labels[outcome.attendanceCase] ??
              systemCodeLabel(outcome.attendanceCase)}
          </dd>
          <dt>Người dạy</dt>
          <dd>
            {labels[outcome.teacherVerdict] ??
              systemCodeLabel(outcome.teacherVerdict)}{" "}
            · {outcome.teacherSeconds} giây
            {outcome.teacherLate ? " · Vào muộn" : ""}
          </dd>
          <dt>Người học</dt>
          <dd>
            {labels[outcome.learnerVerdict] ??
              systemCodeLabel(outcome.learnerVerdict)}{" "}
            · {outcome.learnerSeconds} giây
            {outcome.learnerLate ? " · Vào muộn" : ""}
          </dd>
          <dt>Trạng thái kết quả</dt>
          <dd>{systemCodeLabel(outcome.status)}</dd>
          <dt>Phán quyết</dt>
          <dd>
            {outcome.resolution
              ? systemCodeLabel(outcome.resolution)
              : "Chưa có"}
          </dd>
          <dt>Ghi nhận lúc</dt>
          <dd>{fmtDateTime(outcome.determinedAt)}</dd>
          <dt>Hạn xử lý</dt>
          <dd>{fmtDateTime(outcome.finalizesAt)}</dd>
        </dl>
      </details>
    </Card>
  );
}
function durationText(value: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value))
    return "Chưa có dữ liệu";
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 0) return "Chưa có dữ liệu";
  return `${Math.floor(seconds / 60)} phút${seconds % 60 ? ` ${seconds % 60} giây` : ""}`;
}
