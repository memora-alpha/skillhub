"use client";

import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
} from "@/components/console/ui";
import { fmtDateTime, fmtSize } from "@/lib/console/format";
import {
  creditText,
  type MaterialState,
  type ModeratedMaterial,
} from "@/lib/staff/account-types";
import { DecisionDialog, DownloadButton, QueueState } from "./common";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";

const states: Record<MaterialState, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  PUBLISHED: "Đã công bố",
  REJECTED: "Đã từ chối",
  HIDDEN: "Đang ẩn",
  ARCHIVED: "Đã lưu trữ",
};
type Action = "approve" | "reject" | "hide" | "unhide";
const labels: Record<Action, string> = {
  approve: "Duyệt tài liệu",
  reject: "Từ chối tài liệu",
  hide: "Ẩn tài liệu",
  unhide: "Hiện lại tài liệu",
};

export function MaterialsScreen() {
  const { api, actor } = useStaffSession();
  const [status, setStatus] = useState<MaterialState>("PENDING_REVIEW");
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<{
    item: ModeratedMaterial;
    action: Action;
  } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queue = useStaffList<ModeratedMaterial>(`materials?status=${status}`);
  const items = queue.items.filter((item) =>
    `${item.title} ${item.description}`
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi")),
  );
  const reload = () => {
    setDecision(null);
    void queue.reload();
  };
  return (
    <>
      <PageHeader
        title="Duyệt tài liệu"
        desc="Xem tài liệu được gửi lên và quyết định công bố hoặc ẩn nội dung."
        actions={
          <button
            type="button"
            className="btn"
            disabled={queue.loading}
            onClick={reload}
          >
            Làm mới
          </button>
        }
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm trong tài liệu đã tải"
          placeholder="Tên hoặc mô tả tài liệu…"
          value={query}
          onChange={setQuery}
        />
        <label className="staff-field">
          <span className="sr-only">Trạng thái tài liệu</span>
          <select
            className="select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as MaterialState);
              setSuccess(null);
              setDecision(null);
            }}
          >
            {Object.entries(states).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {success && <output className="staff-success">{success}</output>}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={reload}
        >
          {!items.length ? (
            <Empty
              title="Không tìm thấy tài liệu"
              desc="Thử từ khóa khác hoặc đổi trạng thái."
            />
          ) : (
            <ul className="q-list" aria-label="Tài liệu cần xem xét">
              {items.map((item) => {
                const self = item.ownerId === actor?.userId;
                const actions: Action[] = [];
                if (item.status === "PENDING_REVIEW")
                  actions.push("approve", "reject");
                if (item.status === "PUBLISHED") actions.push("hide");
                if (item.status === "HIDDEN") actions.push("unhide");
                return (
                  <li className="staff-material" key={item.id}>
                    <div className="stack">
                      <div className="row">
                        <Badge>{states[item.status]}</Badge>
                        <Badge
                          tone={item.accessType === "FREE" ? "ok" : "neutral"}
                        >
                          {item.accessType === "FREE"
                            ? "Miễn phí"
                            : creditText(item.priceCredit)}
                        </Badge>
                      </div>
                      <h2 className="sub-title">{item.title}</h2>
                      <p className="prose">{item.description}</p>
                      <dl className="kv staff-kv">
                        <dt>Người đăng</dt>
                        <dd className="mono">{item.ownerId}</dd>
                        <dt>Cập nhật</dt>
                        <dd>{fmtDateTime(item.updatedAt)}</dd>
                        <dt>Tệp</dt>
                        <dd>
                          {item.file
                            ? `${item.file.originalFilename ?? item.file.mimeType}${item.file.sizeBytes ? ` · ${fmtSize(Number(item.file.sizeBytes))}` : ""}`
                            : "Chưa có tệp"}
                        </dd>
                        <dt>Kiểm tra an toàn</dt>
                        <dd>
                          {item.scanStatus === "CLEAN"
                            ? "Đã kiểm tra an toàn"
                            : item.scanStatus === "PENDING"
                              ? "Đang kiểm tra"
                              : item.scanStatus}
                        </dd>
                      </dl>
                      {item.file && (
                        <DownloadButton
                          path={`materials/${item.id}/download`}
                          name={item.file.originalFilename ?? item.title}
                        />
                      )}
                      {item.rejectReason && (
                        <p className="staff-error">
                          Lý do từ chối: {item.rejectReason}
                        </p>
                      )}
                      {self &&
                        actions.some(
                          (action) =>
                            action === "approve" || action === "unhide",
                        ) && (
                          <p className="muted">
                            Tài liệu của bạn cần một nhân viên khác duyệt hoặc
                            hiện lại.
                          </p>
                        )}
                      {!!actions.length && (
                        <div className="row">
                          {actions.map((action) => (
                            <button
                              type="button"
                              className={`btn ${action === "approve" || action === "unhide" ? "btn-primary" : ""}`}
                              key={action}
                              disabled={
                                self &&
                                (action === "approve" || action === "unhide")
                              }
                              onClick={() => setDecision({ item, action })}
                            >
                              {labels[action]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </QueueState>
        {!queue.error && (
          <p className="staff-state muted">
            {queue.items.length} tài liệu đã tải · Mỗi trạng thái hiển thị tối
            đa 100 mục.
          </p>
        )}
      </Card>
      {decision && (
        <DecisionDialog
          title={labels[decision.action]}
          description={`Tài liệu: ${decision.item.title}`}
          confirmLabel={labels[decision.action]}
          danger={decision.action === "hide" || decision.action === "reject"}
          min={decision.action === "approve" ? 0 : 1}
          max={2000}
          onClose={() => setDecision(null)}
          onReload={reload}
          onSubmit={async (reason) => {
            await api(`materials/${decision.item.id}/${decision.action}`, {
              method: "POST",
              body: {
                expectedListingVersion: decision.item.listingVersion,
                ...(reason ? { reason } : {}),
              },
            });
            setSuccess("Đã lưu quyết định xử lý tài liệu.");
            await queue.reload();
          }}
        />
      )}
    </>
  );
}
