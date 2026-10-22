"use client";
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
import type { ReportCase, ReportCaseDetail } from "@/lib/staff/types";
import {
  reportResolutionBody,
  type ResolutionDraft,
} from "@/lib/staff/report-resolution";
import { ReportResolutionFields } from "./report-resolution";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, DownloadButton, QueueState } from "./common";
const reasons: Record<string, string> = {
  NO_SHOW_LATE: "Vắng mặt hoặc đến muộn",
  INAPPROPRIATE_BEHAVIOR: "Hành vi không phù hợp",
  SKILL_MISMATCH: "Kỹ năng không đúng thỏa thuận",
  FALSE_INFORMATION: "Thông tin sai lệch",
  CREDIT_ISSUE: "Vấn đề Credit",
  SPAM_SCAM: "Spam hoặc lừa đảo",
  OTHER: "Lý do khác",
  NO_SHOW: "Không tham gia buổi học",
  LATE_CANCELLATION: "Hủy muộn",
  TECHNICAL_ISSUE: "Vấn đề kỹ thuật",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  HARASSMENT: "Quấy rối",
  FRAUD: "Gian lận",
};
export function ReportsScreen() {
  const { portal } = useStaffSession();
  const queue = useStaffList<ReportCase>("reports");
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
          <button
            type="button"
            className="btn"
            disabled={queue.loading}
            onClick={queue.reload}
          >
            Làm mới
          </button>
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
          label="Tìm trong báo cáo đã tải"
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
                      <td>{reasons[item.reasonCode] ?? item.reasonCode}</td>
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
        <div className="staff-pager muted">
          {queue.items.length} báo cáo đang mở đã tải · hiển thị tối đa 100 mục
        </div>
      </Card>
    </>
  );
}
type ReportAction = "claim" | "need-more-info" | "resolve" | "reject";
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
  "need-more-info": {
    title: "Yêu cầu bổ sung thông tin",
    label: "Gửi yêu cầu bổ sung",
    description:
      "Ghi rõ thông tin còn thiếu để người gửi biết nội dung cần bổ sung.",
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
function ReportOverview({ item }: Readonly<{ item: ReportCase }>) {
  return (
    <Card title="Nội dung báo cáo">
      <div className="stack">
        <div className="row">
          <StatusBadge status={item.status} />
          <Badge tone={item.blocksSettlement ? "warn" : "neutral"}>
            {item.blocksSettlement
              ? "Settlement đang bị chặn"
              : "Không chặn settlement"}
          </Badge>
        </div>
        <h3 className="sub-title">
          {reasons[item.reasonCode] ?? item.reasonCode}
        </h3>
        <p className="prose">{item.description}</p>
        <dl className="kv staff-kv">
          <dt>Mã báo cáo</dt>
          <dd className="mono">{item.id}</dd>
          <dt>Người gửi</dt>
          <dd className="mono">{item.reporterId}</dd>
          <dt>Đối tượng báo cáo</dt>
          <dd>
            {item.targetType === "MATERIAL"
              ? "Tài liệu"
              : item.targetType === "SESSION"
                ? "Buổi học"
                : item.targetType}
          </dd>
          <dt>Mã đối tượng</dt>
          <dd className="mono">{item.targetId}</dd>
          {item.relatedSessionId && (
            <>
              <dt>Buổi học liên quan</dt>
              <dd className="mono">{item.relatedSessionId}</dd>
            </>
          )}
          {item.relatedMaterialId && (
            <>
              <dt>Tài liệu liên quan</dt>
              <dd className="mono">{item.relatedMaterialId}</dd>
            </>
          )}
          {item.relatedOrderId && (
            <>
              <dt>Đơn mua tài liệu</dt>
              <dd className="mono">{item.relatedOrderId}</dd>
            </>
          )}
          <dt>Learning Path</dt>
          <dd className="mono">{item.relatedPathId ?? "Không có"}</dd>
          <dt>Ngày gửi</dt>
          <dd>{fmtDateTime(item.createdAt)}</dd>
          <dt>Người xử lý</dt>
          <dd className="mono">{item.handlerId ?? "Chưa được giao"}</dd>
        </dl>
      </div>
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
  item: ReportCase;
  owns: boolean;
  busy: boolean;
  onAction: (action: ReportAction) => void;
}>;
function ReportActions({ item, owns, busy, onAction }: ReportActionProps) {
  if (item.status === "RESOLVED" || item.status === "REJECTED")
    return <StatusBadge status={item.status} />;
  if (item.status === "OPEN")
    return (
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => onAction("claim")}
      >
        Nhận xử lý
      </button>
    );
  if (!owns)
    return (
      <p className="staff-flag">
        Một nhân viên khác đang phụ trách vụ việc này.
      </p>
    );
  return (
    <>
      <p className="muted">Bạn đang phụ trách vụ việc này.</p>
      {item.status !== "NEED_MORE_INFO" && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => onAction("need-more-info")}
        >
          Yêu cầu bổ sung thông tin
        </button>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => onAction("resolve")}
      >
        Đã xử lý
      </button>
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={() => onAction("reject")}
      >
        Bác bỏ báo cáo
      </button>
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
    return <output className="staff-state">Đang tải vụ việc…</output>;
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
    <div className="grid grid-2 staff-report-grid">
      <div className="stack">
        <ReportOverview item={item} />
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
        <Card title="Bằng chứng">
          <ReportFiles files={item.reportEvidenceCaseIdRecords} />
        </Card>
      </div>
      <Card title="Xử lý vụ việc">
        <div className="stack">
          {confirmed && (
            <output className="staff-success">
              Máy chủ đã ghi nhận thao tác.
            </output>
          )}
          {item.resolutionNote && (
            <section>
              <h3 className="sub-title">Ghi chú xử lý</h3>
              <p className="prose">{item.resolutionNote}</p>
            </section>
          )}
          <ReportActions
            item={item}
            owns={owns}
            busy={busy}
            onAction={onAction}
          />
        </div>
      </Card>
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
  const { api, actor, demo } = useStaffSession();
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
  });
  return (
    <DecisionDialog
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
        await api<ReportCase>("reports/" + item.id + "/" + action, {
          method: "POST",
          body: {
            ...(note ? { note } : {}),
            ...(action === "resolve" && item.path && !demo
              ? reportResolutionBody(draft, admin)
              : {}),
          },
        });
        onComplete();
      }}
    >
      {action === "resolve" && demo && (
        <p className="muted">
          Trong dữ liệu thử, bạn có thể ghi chú và đóng báo cáo. Các thay đổi
          Credit, uy tín và hạn chế tài khoản cần được kiểm tra trên hệ thống
          thật.
        </p>
      )}
      {action === "resolve" && item.path && !demo && (
        <ReportResolutionFields
          value={draft}
          admin={admin}
          onChange={setDraft}
        />
      )}
    </DecisionDialog>
  );
}
export function ReportDetailScreen({ id }: Readonly<{ id: string }>) {
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
      <PageHeader
        title="Chi tiết báo cáo"
        desc={"Báo cáo #" + id.slice(0, 8)}
        back={
          <Link className="link" href={"/" + portal + "/disputes"}>
            ← Hàng đợi báo cáo
          </Link>
        }
        actions={
          <button
            type="button"
            className="btn"
            disabled={resource.loading}
            onClick={reload}
          >
            Làm mới
          </button>
        }
      />
      <ReportDetailContent
        item={item}
        loading={resource.loading}
        error={resource.error}
        confirmed={confirmedId === id}
        owns={item?.handlerId === actor?.userId}
        busy={action !== null}
        reload={reload}
        onAction={setAction}
      />
      {item && action && (
        <ReportDecision
          key={id + ":" + action}
          item={item}
          action={action}
          onClose={() => setAction(null)}
          reload={reload}
          onComplete={() => {
            setConfirmedId(id);
            void resource.reload();
          }}
        />
      )}
    </>
  );
}
