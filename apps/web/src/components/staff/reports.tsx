"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { reportDescriptionText } from "@/lib/system-text";
import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime, fmtSize } from "@/lib/console/format";
import {
  assertReportEditable,
  isSystemReport,
} from "@/lib/staff/report-access";
import type { ReportCase, ReportCaseDetail } from "@/lib/staff/types";
import {
  reportResolutionBody,
  type ResolutionDraft,
} from "@/lib/staff/report-resolution";
import { ReportResolutionFields } from "./report-resolution";
import {
  assertReportRuling,
  assertReportRulingCurrent,
} from "@/lib/staff/report-ruling";
import { AttendanceEvidence } from "./attendance-evidence";
import { RecordId } from "./admin-ui";
import { CaseSupportPanel } from "./case-support";
import { useStaffResource } from "./hooks";
import { useStaffListPages } from "./use-staff-list-pages";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffSession } from "./session";
import { DecisionDialog, DownloadButton, QueueState } from "./common";
import {
  reportReasonLabel,
  reportDateLabel,
  targetTypeLabel,
} from "@/lib/staff/report-presentation";
export function ReportsScreen() {
  const { portal } = useStaffSession();
  const queue = useStaffListPages<ReportCase>("reports");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const items = queue.items.filter(
    (r) =>
      (status === "ALL" || r.status === status) &&
      `${r.id} ${r.reasonCode} ${r.description}`
        .toLocaleLowerCase("vi")
        .includes(q.trim().toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeader
        title="Báo cáo & tranh chấp"
        desc="Xem báo cáo buổi học, tài liệu và ghi nhận kết quả xử lý."
        actions={
          <LoadingButton
            type="button"
            className="btn"
            disabled={queue.loading}
            onClick={queue.reload}
            loading={!!queue.loading}
          >
            Làm mới
          </LoadingButton>
        }
      />
      <div className="toolbar">
        <Segmented
          label="Trạng thái báo cáo"
          value={status}
          onChange={setStatus}
          options={[
            { id: "ALL", label: "Tất cả" },
            { id: "OPEN", label: "Mới" },
            { id: "UNDER_REVIEW", label: "Đang xem xét" },
            { id: "NEED_MORE_INFO", label: "Cần bổ sung" },
          ]}
        />
        <SearchBox
          label="Tìm báo cáo trên trang này"
          placeholder="Mã hoặc nội dung báo cáo…"
          value={q}
          onChange={setQ}
        />
      </div>
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={queue.reload}
        >
          {!items.length ? (
            <Empty
              title="Không có kết quả"
              desc="Thử trạng thái hoặc từ khóa khác."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Báo cáo</th>
                    <th>Lý do</th>
                    <th>Trạng thái</th>
                    <th>Settlement</th>
                    <th>Gửi lúc</th>
                    <th>
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="mono">#{item.id.slice(0, 8)}</td>
                      <td>{reportReasonLabel(item.reasonCode)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <Badge
                          tone={item.blocksSettlement ? "warn" : "neutral"}
                        >
                          {item.blocksSettlement ? "Đang chặn" : "Không chặn"}
                        </Badge>
                      </td>
                      <td>{fmtDateTime(item.createdAt)}</td>
                      <td>
                        <Link
                          className="link"
                          href={`/${portal}/disputes/${item.id}`}
                        >
                          Xem chi tiết →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueueState>
        <ListPagination query={queue} />
      </Card>
    </>
  );
}
type ReportAction = "claim" | "resolve" | "reject";
const actions: Record<
  ReportAction,
  { title: string; label: string; description: string }
> = {
  claim: {
    title: "Nhận xử lý báo cáo",
    label: "Nhận xử lý",
    description:
      "Vụ việc sẽ được giao cho bạn và chuyển sang trạng thái đang xem xét.",
  },
  resolve: {
    title: "Hoàn tất xử lý báo cáo",
    label: "Xác nhận đã xử lý",
    description: "Ghi lại kết quả xem xét và các biện pháp xử lý đã chọn.",
  },
  reject: {
    title: "Bác bỏ báo cáo",
    label: "Xác nhận bác bỏ",
    description: "Nêu rõ lý do bác bỏ để kết quả xử lý có thể truy vết.",
  },
};
function ReportOverview({ item, owns, busy, onAction }: ReportActionProps) {
  const { portal } = useStaffSession();
  function handlerIdentity() {
    if (item.handlerId) {
      if (portal === "admin") {
        return <RecordId id={item.handlerId} label="người phụ trách" />;
      }
      return (
        <span className="mono" title={item.handlerId}>
          #{item.handlerId.slice(0, 8)}
        </span>
      );
    }
    return "Chưa có người nhận" as const;
  }
  function reporterIdentity() {
    if (item.reporterId) {
      if (portal === "admin") {
        return <RecordId id={item.reporterId} label="người gửi" />;
      }
      return (
        <span className="mono" title={item.reporterId}>
          #{item.reporterId.slice(0, 8)}
        </span>
      );
    }
    return "Hệ thống tự ghi nhận" as const;
  }
  return (
    <Card className="ops-case-overview">
      <div className="row ops-case-claim-action" aria-label="Thao tác báo cáo">
        <ReportActions
          item={item}
          owns={owns}
          busy={busy}
          onAction={onAction}
        />
      </div>
      <div className="ops-case-title">
        {portal === "admin" ? (
          <RecordId id={item.id} label="báo cáo" />
        ) : (
          <span className="mono" title={item.id}>
            #{item.id.slice(0, 8)}
          </span>
        )}
        <h2>{reportReasonLabel(item.reasonCode)}</h2>
        <div className="row">
          <StatusBadge status={item.status} />
          <Badge tone={item.blocksSettlement ? "warn" : "neutral"}>
            {item.blocksSettlement
              ? "Đang chặn quyết toán"
              : "Không chặn quyết toán"}
          </Badge>
        </div>
      </div>
      <dl className="ops-case-facts">
        <div>
          <dt>Đối tượng</dt>
          <dd>{targetTypeLabel(item.targetType)}</dd>
        </div>
        <div>
          <dt>Người gửi</dt>
          <dd>{reporterIdentity()}</dd>
        </div>
        <div>
          <dt>Thời điểm gửi</dt>
          <dd>{reportDateLabel(item.createdAt)}</dd>
        </div>
        <div>
          <dt>Người phụ trách</dt>
          <dd>{handlerIdentity()}</dd>
        </div>
      </dl>
      <section className="ops-case-description">
        <h3 className="sub-title">Mô tả sự việc</h3>
        <p className="prose">
          {reportDescriptionText(item.description) || "Chưa có mô tả bổ sung."}
        </p>
      </section>
      <details className="ops-case-identifiers">
        <summary>Mã tham chiếu liên quan</summary>
        <dl className="kv staff-kv">
          <dt>Báo cáo</dt>
          <dd className="mono">{item.id}</dd>
          <dt>Đối tượng</dt>
          <dd className="mono">{item.targetId}</dd>
          {item.relatedPathId && (
            <>
              <dt>Lộ trình</dt>
              <dd className="mono">{item.relatedPathId}</dd>
            </>
          )}
          {item.relatedSessionId && (
            <>
              <dt>Buổi học</dt>
              <dd className="mono">{item.relatedSessionId}</dd>
            </>
          )}
          {item.relatedMaterialId && (
            <>
              <dt>Tài liệu</dt>
              <dd className="mono">{item.relatedMaterialId}</dd>
            </>
          )}
          {item.relatedOrderId && (
            <>
              <dt>Đơn mua</dt>
              <dd className="mono">{item.relatedOrderId}</dd>
            </>
          )}
        </dl>
      </details>
    </Card>
  );
}
function ReportFiles({
  files,
}: Readonly<{ files: ReportCase["reportEvidenceCaseIdRecords"] }>) {
  if (!files?.length)
    return <p className="muted">Không có bằng chứng đính kèm.</p>;
  return (
    <div className="stack">
      {files.map((file, index) => (
        <div className="staff-evidence-file" key={file.id}>
          <strong>Bằng chứng {index + 1}</strong>
          <p className="muted">
            {file.mimeType} · {fmtSize(Number(file.fileSizeBytes))} ·{" "}
            {fmtDateTime(file.uploadedAt)}
          </p>
          <DownloadButton
            path={"reports/evidence/" + file.id + "/download"}
            name={"Bằng chứng " + (index + 1)}
          />
        </div>
      ))}
    </div>
  );
}
type ReportActionProps = Readonly<{
  item: ReportCaseDetail;
  owns: boolean;
  busy: boolean;
  onAction: (action: ReportAction) => void;
}>;
function ReportActions({ item, owns, busy, onAction }: ReportActionProps) {
  const { actor } = useStaffSession();
  if (isSystemReport(item)) return <Badge tone="info">Chỉ xem</Badge>;
  const self = [
    item.reporterId,
    item.targetType === "USER" ? item.targetId : null,
    item.path?.participantAId,
    item.path?.participantBId,
    item.session?.teacherId,
    item.session?.learnerId,
  ].some((id) => !!id && id === actor?.userId);
  if (!["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(item.status))
    return null;
  if (self)
    return (
      <p className="staff-flag">
        Vụ việc có liên quan đến bạn. Cần một nhân viên khác xem xét và xử lý.
      </p>
    );
  if (item.status === "OPEN")
    return (
      <LoadingButton
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => onAction("claim")}
        loading={!!busy}
      >
        Nhận xử lý
      </LoadingButton>
    );
  if (!owns)
    return (
      <p className="staff-flag">
        Một nhân viên khác đang phụ trách vụ việc này.
      </p>
    );
  if (item.incidentId)
    return (
      <p className="staff-flag">
        Báo cáo đã gom vào vụ việc chung. Mở quyết định chung bên dưới.
      </p>
    );
  return (
    <>
      <p className="muted">Bạn đang phụ trách vụ việc này.</p>
      <LoadingButton
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => onAction("resolve")}
        loading={!!busy}
      >
        Đưa ra quyết định
      </LoadingButton>
      <LoadingButton
        type="button"
        className="btn admin-danger-outline"
        disabled={busy}
        onClick={() => onAction("reject")}
        loading={!!busy}
      >
        Bác bỏ báo cáo
      </LoadingButton>
    </>
  );
}
function ReportDetailContent({
  item,
  loading,
  error,
  confirmed,
  owns,
  busy,
  reload,
  onAction,
}: Readonly<{
  item: ReportCaseDetail | null | undefined;
  loading: boolean;
  error?: string;
  confirmed: boolean;
  owns: boolean;
  busy: boolean;
  reload: () => void;
  onAction: (action: ReportAction) => void;
}>) {
  const { portal } = useStaffSession();
  if (error)
    return (
      <QueueState error={error} loading={false} empty reload={reload}>
        {null}
      </QueueState>
    );
  if (loading && !item)
    return <LoadingSkeleton variant="section" label="Đang tải vụ việc" />;
  if (!item)
    return (
      <Card>
        <Empty
          title="Không tìm thấy báo cáo"
          desc="Vụ việc không tồn tại hoặc bạn không có quyền truy cập."
        />
        <Link className="link" href={"/" + portal + "/disputes"}>
          Quay lại hàng đợi
        </Link>
      </Card>
    );
  return (
    <div
      className="grid grid-2 staff-report-grid"
      data-unclaimed={item.status === "OPEN" || undefined}
    >
      <div className="stack admin-report-sections">
        {confirmed && (
          <output className="staff-success">
            Máy chủ đã ghi nhận thao tác.
          </output>
        )}
        <ReportOverview
          item={item}
          owns={owns}
          busy={busy}
          onAction={onAction}
        />
        <AttendanceEvidence outcome={item.attendanceOutcome} />
        <Card title="Bằng chứng">
          <ReportFiles files={item.reportEvidenceCaseIdRecords} />
        </Card>
        {(item.session || item.path) && (
          <details className="ops-case-context">
            <summary>Thông tin buổi học và thỏa thuận</summary>
            {item.session && (
              <Card title="Phiên học liên quan">
                <dl className="kv staff-kv">
                  <dt>Trạng thái</dt>
                  <dd>
                    <StatusBadge status={item.session.status} />
                  </dd>
                  <dt>Người dạy</dt>
                  <dd className="mono">{item.session.teacherId}</dd>
                  <dt>Người học</dt>
                  <dd className="mono">{item.session.learnerId}</dd>
                  <dt>Bắt đầu</dt>
                  <dd>{fmtDateTime(item.session.startAt)}</dd>
                  <dt>Kết thúc</dt>
                  <dd>{fmtDateTime(item.session.endAt)}</dd>
                  <dt>Xác nhận người dạy</dt>
                  <dd>{item.session.teacherConfirmationStatus}</dd>
                  <dt>Xác nhận người học</dt>
                  <dd>{item.session.learnerConfirmationStatus}</dd>
                </dl>
              </Card>
            )}
            {item.path && (
              <Card title="Lộ trình liên quan">
                <dl className="kv staff-kv">
                  <dt>Trạng thái</dt>
                  <dd>
                    <StatusBadge status={item.path.status} />
                  </dd>
                  <dt>Người tham gia 1</dt>
                  <dd className="mono">{item.path.participantAId}</dd>
                  <dt>Người tham gia 2</dt>
                  <dd className="mono">{item.path.participantBId}</dd>
                  <dt>Quyết toán</dt>
                  <dd>
                    {item.path.settledAt
                      ? fmtDateTime(item.path.settledAt)
                      : "Chưa quyết toán"}
                  </dd>
                </dl>
              </Card>
            )}
          </details>
        )}
        <CaseSupportPanel item={item} onUpdated={reload} />
      </div>
      {item.resolutionNote && (
        <Card title="Kết quả xử lý" className="ops-case-decision">
          <p className="prose">{item.resolutionNote}</p>
        </Card>
      )}
    </div>
  );
}
function ReportDecision({
  item,
  action,
  onClose,
  reload,
  onComplete,
}: Readonly<{
  item: ReportCaseDetail;
  action: ReportAction;
  onClose: () => void;
  reload: () => void;
  onComplete: () => void;
}>) {
  const { api, actor } = useStaffSession();
  const admin = actor?.roles.includes("ADMIN") ?? false;
  const [draft, setDraft] = useState<ResolutionDraft>({
    participants: item.path
      ? [item.path.participantAId, item.path.participantBId].map((userId) => ({
          userId,
          violation: "",
          delta: "",
          amount: "",
        }))
      : [],
    restrictedUserId: "",
    days: "1",
    reversals: "",
    noShowRuling: "",
  });
  return (
    <DecisionDialog
      presentation="drawer"
      title={actions[action].title}
      description={actions[action].description}
      label={action === "claim" ? "Ghi chú" : "Nội dung xử lý"}
      min={action === "claim" ? 0 : 1}
      max={2000}
      confirmLabel={actions[action].label}
      danger={action === "reject"}
      onClose={onClose}
      onReload={reload}
      onSubmit={async (note) => {
        assertReportEditable(item);
        const fresh = await api<ReportCaseDetail>("reports/" + item.id);
        assertReportEditable(fresh.data);
        if (action === "resolve" || action === "reject") {
          assertReportRuling(item, draft, action);
          assertReportRulingCurrent(item, fresh.data);
          assertReportRuling(fresh.data, draft, action);
        }
        await api<ReportCase>("reports/" + item.id + "/" + action, {
          method: "POST",
          body: {
            ...(note ? { note } : {}),
            ...(action === "resolve" && item.path
              ? reportResolutionBody(draft, admin)
              : {}),
          },
        });
        onComplete();
      }}
    >
      {action === "resolve" && item.path && (
        <ReportResolutionFields
          item={item}
          value={draft}
          admin={admin}
          onChange={setDraft}
        />
      )}
    </DecisionDialog>
  );
}
export function ReportDetailScreen({
  id,
  embedded = false,
  onUpdated,
}: Readonly<{ id: string; embedded?: boolean; onUpdated?: () => void }>) {
  const { actor, portal } = useStaffSession();
  const resource = useStaffResource<ReportCaseDetail>(`reports/${id}`);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [action, setAction] = useState<ReportAction | null>(null);
  const item = resource.data;
  const reload = () => {
    setConfirmedId(null);
    void resource.reload();
  };
  return (
    <>
      {!embedded && (
        <PageHeader
          title="Chi tiết báo cáo"
          desc={"Báo cáo #" + id.slice(0, 8)}
          back={
            <Link className="link" href={"/" + portal + "/disputes"}>
              ← Hàng đợi báo cáo
            </Link>
          }
          actions={
            <LoadingButton
              type="button"
              className="btn"
              disabled={resource.loading}
              onClick={reload}
              loading={!!resource.loading}
            >
              Làm mới
            </LoadingButton>
          }
        />
      )}
      {embedded && (
        <div className="ops-case-toolbar">
          <h2>Chi tiết báo cáo</h2>
          <div className="row">
            <LoadingButton
              type="button"
              className="btn btn-sm"
              disabled={resource.loading}
              onClick={reload}
              loading={!!resource.loading}
            >
              Cập nhật
            </LoadingButton>
            <Link className="link" href={`/${portal}/disputes/${id}`}>
              Mở trang chi tiết →
            </Link>
          </div>
        </div>
      )}
      <ReportDetailContent
        item={item}
        loading={resource.loading}
        error={resource.error}
        confirmed={confirmedId === id}
        owns={item?.handlerId === actor?.userId}
        busy={action !== null}
        reload={reload}
        onAction={(value) => {
          if (item && !isSystemReport(item)) setAction(value);
        }}
      />
      {item && !isSystemReport(item) && action && (
        <ReportDecision
          key={id + ":" + action}
          item={item}
          action={action}
          onClose={() => setAction(null)}
          reload={reload}
          onComplete={() => {
            setConfirmedId(id);
            void resource.reload();
            onUpdated?.();
          }}
        />
      )}
    </>
  );
}
