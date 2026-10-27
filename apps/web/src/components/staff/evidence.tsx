"use client";
import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime, fmtSize } from "@/lib/console/format";
import type { Verification } from "@/lib/staff/types";
import { useStaffSession } from "./session";
import { useStaffList, useStaffResource } from "./hooks";
import { DecisionDialog, DownloadButton, Pager, QueueState } from "./common";
type Decision = {
  action: "approve" | "reject" | "revoke";
  evidenceId?: string;
};
const decisionLabels = {
  approve: {
    title: "Phê duyệt yêu cầu xác minh",
    confirmLabel: "Xác nhận phê duyệt",
  },
  reject: {
    title: "Từ chối yêu cầu xác minh",
    confirmLabel: "Xác nhận từ chối",
  },
  revoke: {
    title: "Thu hồi phê duyệt bằng chứng",
    confirmLabel: "Xác nhận thu hồi",
  },
};
function decisionBody(
  action: Decision["action"],
  version: number,
  note: string,
) {
  if (action === "approve")
    return { expectedVersion: version, ...(note ? { note } : {}) };
  if (action === "reject")
    return { expectedVersion: version, rejectReason: note };
  return { reason: note };
}
function VerificationDetail({
  id,
  onQueueReload,
}: Readonly<{
  id: string;
  onQueueReload: () => void;
}>) {
  const { api, actor } = useStaffSession();
  const detail = useStaffResource<Verification>(`verifications/${id}`);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const item = detail.data;
  return (
    <Card title="Chi tiết yêu cầu xác minh">
      <QueueState
        loading={detail.loading}
        error={detail.error}
        empty={!item}
        reload={detail.reload}
      >
        {item && (
          <div className="stack">
            <div className="row">
              <StatusBadge status={item.status} />
              <Badge>Phiên bản {item.version}</Badge>
            </div>
            <dl className="kv staff-kv">
              <dt>Mã yêu cầu</dt>
              <dd className="mono">{item.id}</dd>
              <dt>Sharing Skill</dt>
              <dd className="mono">{item.sharingSkillId}</dd>
              <dt>Gửi lúc</dt>
              <dd>{fmtDateTime(item.submittedAt)}</dd>
              {item.reviewedAt && (
                <>
                  <dt>Đã xem xét</dt>
                  <dd>{fmtDateTime(item.reviewedAt)}</dd>
                </>
              )}
              {item.note && (
                <>
                  <dt>Ghi chú</dt>
                  <dd>{item.note}</dd>
                </>
              )}
              {item.rejectReason && (
                <>
                  <dt>Lý do từ chối</dt>
                  <dd>{item.rejectReason}</dd>
                </>
              )}
            </dl>
            {success && <output className="staff-success">{success}</output>}
            <h3 className="sub-title">
              Bằng chứng đính kèm ({item.files.length})
            </h3>
            {item.files.map((file, index) => (
              <section className="staff-evidence-file" key={file.id}>
                <div className="row">
                  <strong>{file.title || `Bằng chứng ${index + 1}`}</strong>
                  <StatusBadge status={file.approvalStatus} />
                </div>
                {file.description && (
                  <p className="prose">{file.description}</p>
                )}
                <p className="muted">
                  {file.mimeType} · {fmtSize(Number(file.fileSizeBytes))}
                </p>
                {file.rejectReason && <p>Lý do từ chối: {file.rejectReason}</p>}
                {file.revokedReason && (
                  <p>Lý do thu hồi: {file.revokedReason}</p>
                )}
                <div className="row">
                  <DownloadButton
                    path={`verifications/${id}/evidence/${file.id}/download`}
                    name={file.title || `Bằng chứng ${index + 1}`}
                  />
                  {actor?.roles.includes("ADMIN") &&
                    file.approvalStatus === "APPROVED" &&
                    !file.revokedAt && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={!!decision || detail.loading}
                        onClick={() =>
                          setDecision({ action: "revoke", evidenceId: file.id })
                        }
                      >
                        Thu hồi phê duyệt
                      </button>
                    )}
                </div>
              </section>
            ))}
            {item.status === "PENDING" && (
              <div className="staff-detail-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!!decision || detail.loading}
                  onClick={() => setDecision({ action: "reject" })}
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!!decision || detail.loading}
                  onClick={() => setDecision({ action: "approve" })}
                >
                  Phê duyệt
                </button>
              </div>
            )}
            {decision && (
              <DecisionDialog
                key={`${decision.action}:${decision.evidenceId ?? id}`}
                title={decisionLabels[decision.action].title}
                description={
                  decision.action === "revoke"
                    ? "Bằng chứng này sẽ không còn được tính là bằng chứng đã phê duyệt."
                    : `Yêu cầu ${id.slice(0, 8)} · phiên bản ${item.version}.`
                }
                label={decision.action === "approve" ? "Ghi chú" : "Lý do"}
                min={decision.action === "approve" ? 0 : 10}
                max={500}
                danger={decision.action !== "approve"}
                confirmLabel={decisionLabels[decision.action].confirmLabel}
                idempotent
                onClose={() => setDecision(null)}
                onReload={() => {
                  void detail.reload();
                  onQueueReload();
                }}
                onSubmit={async (note, key) => {
                  const path =
                    decision.action === "revoke"
                      ? `verifications/${id}/evidence/${decision.evidenceId}/revoke`
                      : `verifications/${id}/${decision.action}`;
                  const body = decisionBody(
                    decision.action,
                    item.version,
                    note,
                  );
                  await api<Verification>(path, {
                    method: "POST",
                    body,
                    key,
                  });
                  setSuccess("Máy chủ đã ghi nhận quyết định.");
                  setDecision(null);
                  await detail.reload();
                  onQueueReload();
                }}
              />
            )}
          </div>
        )}
      </QueueState>
    </Card>
  );
}
export function EvidenceScreen() {
  const [status, setStatus] = useState<Verification["status"]>("PENDING");
  const [selected, setSelected] = useState<string | null>(null);
  const queue = useStaffList<Verification>(
    `verifications?status=${status}&limit=20`,
  );
  return (
    <>
      <PageHeader
        title="Bằng chứng kỹ năng"
        desc="Xem xét các tệp người dùng gửi và ghi nhận kết quả xác minh."
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
          label="Trạng thái xác minh"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setSelected(null);
          }}
          options={[
            { id: "PENDING", label: "Chờ duyệt" },
            { id: "APPROVED", label: "Đã phê duyệt" },
            { id: "REJECTED", label: "Đã từ chối" },
          ]}
        />
        <span className="muted">
          {queue.items.length} mục đã tải
          {queue.page?.hasMore ? " · còn trang tiếp theo" : ""}
        </span>
      </div>
      <div className="split" data-selected={selected !== null}>
        <Card className="split-list" flush>
          <QueueState
            loading={queue.loading}
            error={queue.error}
            empty={!queue.items.length}
            reload={queue.reload}
          >
            <ul className="q-list">
              {queue.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="q-item"
                    aria-current={item.id === selected}
                    onClick={() => setSelected(item.id)}
                  >
                    <strong>Yêu cầu #{item.id.slice(0, 8)}</strong>
                    <span className="q-meta">
                      {item.files.length} tệp bằng chứng · phiên bản{" "}
                      {item.version}
                    </span>
                    <span className="q-meta">
                      <StatusBadge status={item.status} />
                      {fmtDateTime(item.submittedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </QueueState>
          <Pager
            loading={queue.loading}
            hasMore={queue.page?.hasMore}
            more={queue.more}
          />
        </Card>
        <div className="split-detail">
          {selected ? (
            <VerificationDetail
              key={selected}
              id={selected}
              onQueueReload={queue.reload}
            />
          ) : (
            <Card>
              <Empty
                title="Chọn một yêu cầu"
                desc="Kiểm tra tệp và thông tin trước khi quyết định."
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
