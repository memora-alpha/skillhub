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
import type { ReportCase } from "@/lib/staff/types";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, DownloadButton, QueueState } from "./common";
const reasons: Record<string, string> = {
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
        desc="Tiếp nhận báo cáo Session, xem bằng chứng và ghi nhận kết quả xử lý."
        actions={
          <button
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
    description:
      "Ghi lại kết quả xem xét. Thao tác này ghi nhận trạng thái vụ việc, không tạo giao dịch Credit.",
  },
  reject: {
    title: "Bác bỏ báo cáo",
    label: "Xác nhận bác bỏ",
    description: "Nêu rõ lý do bác bỏ để kết quả xử lý có thể truy vết.",
  },
};
export function ReportDetailScreen({ id }: { id: string }) {
  const { actor, portal, api } = useStaffSession();
  const resource = useStaffResource<ReportCase[]>("reports");
  const [receipt, setReceipt] = useState<ReportCase | null>(null);
  const [action, setAction] = useState<ReportAction | null>(null);
  const item =
    receipt ??
    (Array.isArray(resource.data)
      ? resource.data.find((r) => r.id === id)
      : null);
  const owns = item?.handlerId === actor?.userId;
  const closed = item?.status === "RESOLVED" || item?.status === "REJECTED";
  const reload = () => {
    setReceipt(null);
    void resource.reload();
  };
  return (
    <>
      <PageHeader
        title="Chi tiết báo cáo"
        desc={`Báo cáo #${id.slice(0, 8)}`}
        back={
          <Link className="link" href={`/${portal}/disputes`}>
            ← Hàng đợi báo cáo
          </Link>
        }
        actions={
          <button className="btn" disabled={resource.loading} onClick={reload}>
            Làm mới
          </button>
        }
      />
      {resource.error ? (
        <QueueState
          error={resource.error}
          loading={false}
          empty
          reload={reload}
        >
          {null}
        </QueueState>
      ) : resource.loading && !receipt ? (
        <p className="staff-state" role="status">
          Đang tải vụ việc…
        </p>
      ) : !item ? (
        <Card>
          <Empty
            title="Báo cáo không còn trong hàng đợi"
            desc="Vụ việc có thể đã được xử lý hoặc không nằm trong 100 báo cáo đang mở được trả về."
          />
          <Link className="link" href={`/${portal}/disputes`}>
            Quay lại hàng đợi
          </Link>
        </Card>
      ) : (
        <div className="grid grid-2 staff-report-grid">
          <div className="stack">
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
                  <dt>Session liên quan</dt>
                  <dd className="mono">
                    {item.relatedSessionId ?? item.targetId}
                  </dd>
                  <dt>Learning Path</dt>
                  <dd className="mono">{item.relatedPathId ?? "Không có"}</dd>
                  <dt>Ngày gửi</dt>
                  <dd>{fmtDateTime(item.createdAt)}</dd>
                  <dt>Người xử lý</dt>
                  <dd className="mono">{item.handlerId ?? "Chưa được giao"}</dd>
                </dl>
              </div>
            </Card>
            <Card title="Bằng chứng">
              {!item.reportEvidenceCaseIdRecords?.length ? (
                <p className="muted">Không có bằng chứng đính kèm.</p>
              ) : (
                <div className="stack">
                  {item.reportEvidenceCaseIdRecords.map((file, index) => (
                    <div className="staff-evidence-file" key={file.id}>
                      <strong>Bằng chứng {index + 1}</strong>
                      <p className="muted">
                        {file.mimeType} · {fmtSize(Number(file.fileSizeBytes))}{" "}
                        · {fmtDateTime(file.uploadedAt)}
                      </p>
                      <DownloadButton
                        path={`reports/evidence/${file.id}/download`}
                        name={`Bằng chứng ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <Card title="Xử lý vụ việc">
            <div className="stack">
              {receipt && (
                <p className="staff-success" role="status">
                  Máy chủ đã ghi nhận thao tác.
                </p>
              )}
              {item.resolutionNote && (
                <section>
                  <h3 className="sub-title">Ghi chú xử lý</h3>
                  <p className="prose">{item.resolutionNote}</p>
                </section>
              )}
              {closed ? (
                <StatusBadge status={item.status} />
              ) : item.status === "OPEN" ? (
                <button
                  className="btn btn-primary"
                  disabled={!!action}
                  onClick={() => setAction("claim")}
                >
                  Nhận xử lý
                </button>
              ) : owns ? (
                <>
                  <p className="muted">Bạn đang phụ trách vụ việc này.</p>
                  {item.status !== "NEED_MORE_INFO" && (
                    <button
                      className="btn"
                      disabled={!!action}
                      onClick={() => setAction("need-more-info")}
                    >
                      Yêu cầu bổ sung thông tin
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={!!action}
                    onClick={() => setAction("resolve")}
                  >
                    Đã xử lý
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={!!action}
                    onClick={() => setAction("reject")}
                  >
                    Bác bỏ báo cáo
                  </button>
                </>
              ) : (
                <p className="staff-flag">
                  Một nhân viên khác đang phụ trách vụ việc này.
                </p>
              )}
            </div>
          </Card>
          {action && (
            <DecisionDialog
              key={`${id}:${action}`}
              title={actions[action].title}
              description={actions[action].description}
              label={action === "claim" ? "Ghi chú" : "Nội dung xử lý"}
              min={action === "claim" ? 0 : 1}
              confirmLabel={actions[action].label}
              danger={action === "reject"}
              onClose={() => setAction(null)}
              onReload={reload}
              onSubmit={async (note) => {
                const result = await api<ReportCase>(
                  `reports/${id}/${action}`,
                  { method: "POST", body: note ? { note } : {} },
                );
                setReceipt({ ...item, ...result.data });
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
