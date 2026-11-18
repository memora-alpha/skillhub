"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchInput } from "@/components/search-input";
import {
  DataTable,
  Card,
  PageHeader,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import { financeNumber } from "@/lib/staff/finance-presentation";
import { systemCodeLabel } from "@/lib/system-text";
import { useStaffResource } from "./hooks";
import { QueueState } from "./common";
import styles from "./dashboard.module.css";

type Person = { id: string; fullName: string };
type Path = {
  id: string;
  status: string;
  learningStage: string;
  participantA: Person;
  participantB: Person;
  updatedAt: string;
  createdAt: string;
};
const statuses = [
  "DRAFT",
  "PROPOSED",
  "PARTIALLY_CONFIRMED",
  "CONFIRMED",
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];
export function AdminLearningPaths({
  initialStatus = "",
}: Readonly<{ initialStatus?: string }>) {
  const router = useRouter();
  const [status, setStatus] = useState(
    statuses.includes(initialStatus) ? initialStatus : "",
  );
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (term) params.set("q", term);
  const list = useStaffListPages<Path>(`learning-paths?${params}`);
  return (
    <div className={styles.dashboard}>
      <PageHeader
        title="Lộ trình học"
        desc="Tra cứu thỏa thuận, buổi học và tình trạng quyết toán trên toàn hệ thống."
      />
      <Card>
        <div className={styles.filters}>
          <label>
            <span>Tìm lộ trình</span>
            <SearchInput
              maxLength={200}
              value={draft}
              placeholder="Mã lộ trình hoặc tên người tham gia"
              onChange={setDraft}
              onSearch={(value) => {
                if (
                  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
                )
                  router.push(`/admin/learning-paths/${value}`);
                else setTerm(value);
              }}
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {systemCodeLabel(value, "Trạng thái khác")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={list.reload}
          >
            Làm mới
          </button>
        </div>
      </Card>
      <Card>
        <QueueState
          loading={list.loading}
          error={list.error}
          reload={list.reload}
          empty={!list.items.length}
          emptyTitle="Không tìm thấy lộ trình"
          emptyDescription="Thử thay đổi từ khóa hoặc trạng thái."
        >
          <DataTable
            columns={["Người tham gia", "Trạng thái", "Cập nhật", "Thao tác"]}
            className={styles.table}
            containerClassName={styles.tableScroll}
          >
            {list.items.map((path) => (
              <tr key={path.id}>
                <td>
                  <Link href={`/admin/users/${path.participantA.id}`}>
                    {path.participantA.fullName}
                  </Link>
                  <small>
                    và{" "}
                    <Link href={`/admin/users/${path.participantB.id}`}>
                      {path.participantB.fullName}
                    </Link>{" "}
                    · #{path.id.slice(0, 8)}
                  </small>
                </td>
                <td>
                  <StatusBadge status={path.status} />
                  <small>
                    {systemCodeLabel(
                      path.learningStage,
                      "Đang cập nhật giai đoạn",
                    )}
                  </small>
                </td>
                <td>{fmtDateTime(path.updatedAt)}</td>
                <td>
                  <Link
                    className="btn btn-sm"
                    href={`/admin/learning-paths/${path.id}`}
                  >
                    Xem lộ trình
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
          <ListPagination query={list} />
        </QueueState>
      </Card>
    </div>
  );
}
type PathDetail = {
  id: string;
  status: string;
  currentVersion: number;
  lockedVersion: number | null;
  participants: Person[];
  versions: {
    versionNo: number;
    exchangeType: string;
    pathVersionPlanPathVersionRecords: {
      planId: string;
      planVersionRecord: {
        learningGoal: string;
        totalSessions: number;
        skillIdRecord: { name: string };
      };
    }[];
  }[];
  sessions: {
    id: string;
    teacherId: string;
    learnerId: string;
    outlineSessionNo: number;
    startAt: string;
    endAt: string;
    status: string;
    teacherAttendanceSeconds: string;
    learnerAttendanceSeconds: string;
  }[];
  settlement: {
    settledAt: string | null;
    grossCredit: string | null;
    feeCredit: string | null;
    attempt: {
      outcome: string;
      checkedAt: string;
      errorCode: string | null;
    } | null;
  };
  reports: { id: string; status: string; reasonCode: string }[];
  terminations: { id: string; status: string; createdAt: string }[];
  updatedAt: string;
};
/** This reader returns database Credit units (one hundredth of a Credit). */
export function adminPathCredit(units: string | null) {
  if (units === null || !/^-?\d+$/.test(units)) return "—";
  const value = BigInt(units),
    absolute = value < 0n ? -value : value;
  return (
    financeNumber(
      `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`,
    ) + " CR"
  );
}
export function AdminLearningPathDetail({ id }: Readonly<{ id: string }>) {
  const query = useStaffResource<PathDetail>(`learning-paths/${id}`);
  const path = query.data;
  const name = (userId: string) =>
    path?.participants.find((person) => person.id === userId)?.fullName ??
    "Người tham gia";
  const current = path?.versions.find(
    (version) =>
      version.versionNo === (path.lockedVersion ?? path.currentVersion),
  );
  return (
    <div className={styles.dashboard}>
      <PageHeader
        title="Chi tiết lộ trình"
        back={
          <Link className="link" href="/admin/learning-paths">
            ← Danh sách lộ trình
          </Link>
        }
        desc="Thông tin phục vụ kiểm tra và hỗ trợ người dùng."
        actions={
          <button
            type="button"
            className="btn"
            disabled={query.loading}
            onClick={query.reload}
          >
            Cập nhật
          </button>
        }
      />
      <QueueState
        loading={query.loading}
        error={query.error}
        reload={query.reload}
        empty={!path}
      >
        {path && (
          <>
            <Card
              title={
                current?.pathVersionPlanPathVersionRecords
                  .map((plan) => plan.planVersionRecord.skillIdRecord.name)
                  .join(" · ") || "Thỏa thuận học tập"
              }
            >
              <StatusBadge status={path.status} />
              <p>
                {path.participants.map((person, index) => (
                  <span key={person.id}>
                    {index > 0 && " và "}
                    <Link href={`/admin/users/${person.id}`}>
                      {person.fullName}
                    </Link>
                  </span>
                ))}
              </p>
              <p className={styles.caption}>
                Phiên bản {path.lockedVersion ?? path.currentVersion} · Cập nhật{" "}
                {fmtDateTime(path.updatedAt)}
              </p>
              {current?.pathVersionPlanPathVersionRecords.map((plan) => (
                <p key={plan.planId}>
                  {plan.planVersionRecord.learningGoal} ·{" "}
                  {plan.planVersionRecord.totalSessions} buổi
                </p>
              ))}
              <details>
                <summary>Mã lộ trình</summary>
                <code>{path.id}</code>
              </details>
            </Card>
            <Card title={`Buổi học (${path.sessions.length})`}>
              <DataTable
                columns={[
                  "Buổi",
                  "Người dạy / học",
                  "Thời gian",
                  "Trạng thái",
                  "Thời gian tham gia",
                ]}
                className={styles.table}
                containerClassName={styles.tableScroll}
              >
                {path.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>Buổi {session.outlineSessionNo}</td>
                    <td>
                      {name(session.teacherId)}
                      <small>Học viên: {name(session.learnerId)}</small>
                    </td>
                    <td>
                      {fmtDateTime(session.startAt)}
                      <small>Đến {fmtDateTime(session.endAt)}</small>
                    </td>
                    <td>
                      <StatusBadge status={session.status} />
                    </td>
                    <td>
                      Dạy: {session.teacherAttendanceSeconds} giây
                      <small>
                        Học: {session.learnerAttendanceSeconds} giây
                      </small>
                    </td>
                  </tr>
                ))}
              </DataTable>
              {!path.sessions.length && (
                <p className="muted">Lộ trình chưa có buổi học đã chốt.</p>
              )}
            </Card>
            <div className={styles.grid}>
              <Card title="Quyết toán Credit">
                <p>
                  {path.settlement.settledAt
                    ? `Đã quyết toán ${fmtDateTime(path.settlement.settledAt)}`
                    : "Chưa quyết toán"}
                </p>
                <dl className={styles.facts}>
                  <dt>Credit gốc</dt>
                  <dd>{adminPathCredit(path.settlement.grossCredit)}</dd>
                  <dt>Phí nền tảng</dt>
                  <dd>{adminPathCredit(path.settlement.feeCredit)}</dd>
                </dl>
                {path.settlement.attempt && (
                  <p>
                    {systemCodeLabel(
                      path.settlement.attempt.errorCode ??
                        path.settlement.attempt.outcome,
                      "Đã kiểm tra điều kiện quyết toán",
                    )}{" "}
                    · {fmtDateTime(path.settlement.attempt.checkedAt)}
                  </p>
                )}
                <Link href="/admin/credits">Tra cứu giao dịch →</Link>
              </Card>
              <Card title="Vụ việc liên quan">
                {path.reports.map((report) => (
                  <p key={report.id}>
                    <Link href={`/admin/disputes/${report.id}`}>
                      {systemCodeLabel(
                        report.reasonCode,
                        "Báo cáo cần xem xét",
                      )}
                    </Link>{" "}
                    <StatusBadge status={report.status} />
                  </p>
                ))}
                {path.terminations.map((request) => (
                  <p key={request.id}>
                    <Link
                      href={`/admin/learning-changes?pathId=${encodeURIComponent(path.id)}&requestId=${encodeURIComponent(request.id)}`}
                    >
                      Yêu cầu dừng · {fmtDateTime(request.createdAt)}
                    </Link>{" "}
                    <StatusBadge status={request.status} />
                  </p>
                ))}
                {!path.reports.length && !path.terminations.length && (
                  <p className="muted">Không có báo cáo hoặc yêu cầu dừng.</p>
                )}
              </Card>
            </div>
          </>
        )}
      </QueueState>
    </div>
  );
}
