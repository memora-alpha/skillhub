import type { ReportCaseDetail } from "@/lib/staff/types";
import { Card } from "@/components/console/ui";
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
      <dl className="kv staff-kv">
        <dt>Kết luận</dt>
        <dd>{labels[outcome.attendanceCase] ?? outcome.attendanceCase}</dd>
        <dt>Người dạy</dt>
        <dd>
          {labels[outcome.teacherVerdict] ?? outcome.teacherVerdict} ·{" "}
          {outcome.teacherSeconds} giây
          {outcome.teacherLate ? " · Vào muộn" : ""}
        </dd>
        <dt>Người học</dt>
        <dd>
          {labels[outcome.learnerVerdict] ?? outcome.learnerVerdict} ·{" "}
          {outcome.learnerSeconds} giây
          {outcome.learnerLate ? " · Vào muộn" : ""}
        </dd>
        <dt>Trạng thái kết quả</dt>
        <dd>{outcome.status}</dd>
        <dt>Phán quyết</dt>
        <dd>{outcome.resolution ?? "Chưa có"}</dd>
        <dt>Ghi nhận lúc</dt>
        <dd>{fmtDateTime(outcome.determinedAt)}</dd>
        <dt>Hạn xử lý</dt>
        <dd>{fmtDateTime(outcome.finalizesAt)}</dd>
      </dl>
    </Card>
  );
}
