"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Card,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { AdminTag, TagRequest } from "@/lib/staff/admin-types";
import { useStaffCommand, useStaffList, useStaffResource } from "./hooks";
import { DecisionDialog, Pager, QueueState } from "./common";

function TagNavigation({ page }: Readonly<{ page: "catalog" | "requests" }>) {
  return (
    <nav className="toolbar" aria-label="Quản lý tag cộng đồng">
      <Link
        className={`btn ${page === "catalog" ? "btn-primary" : ""}`}
        href="/admin/tags"
        aria-current={page === "catalog" ? "page" : undefined}
      >
        Danh mục tag
      </Link>
      <Link
        className={`btn ${page === "requests" ? "btn-primary" : ""}`}
        href="/admin/tag-requests"
        aria-current={page === "requests" ? "page" : undefined}
      >
        Đề xuất tag
      </Link>
    </nav>
  );
}

export function TagsScreen() {
  const command = useStaffCommand();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<{
    tag?: AdminTag;
    label: string;
    status: "ACTIVE" | "INACTIVE";
  } | null>(null);
  const [success, setSuccess] = useState("");
  const params = new URLSearchParams({ limit: "20" });
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  const queue = useStaffList<AdminTag>(`tags?${params}`);
  const reload = () => {
    setEditor(null);
    return queue.reload();
  };
  return (
    <>
      <PageHeader
        title="Danh mục tag"
        desc="Quản lý tag dùng cho tìm kiếm và yêu cầu học."
        actions={
          <div className="row">
            <button className="btn" disabled={queue.loading} onClick={reload}>
              Làm mới
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setEditor({ label: "", status: "ACTIVE" })}
            >
              Thêm tag
            </button>
          </div>
        }
      />
      <TagNavigation page="catalog" />
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <SearchBox
          label="Tìm tag"
          placeholder="Tên tag…"
          value={q}
          onChange={setQ}
        />
        <button className="btn" type="submit">
          Tìm kiếm
        </button>
        <label>
          <span className="sr-only">Trạng thái tag</span>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Tạm ngưng</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
        </label>
      </form>
      {success && <output className="staff-success">{success}</output>}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={reload}
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((tag) => (
                  <tr key={tag.id}>
                    <td>{tag.label}</td>
                    <td>
                      <StatusBadge status={tag.status} />
                    </td>
                    <td>{fmtDateTime(tag.updatedAt)}</td>
                    <td>
                      {tag.status !== "ARCHIVED" && (
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            setEditor({
                              tag,
                              label: tag.label,
                              status:
                                tag.status === "INACTIVE"
                                  ? "INACTIVE"
                                  : "ACTIVE",
                            })
                          }
                        >
                          Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueueState>
        <Pager
          loading={queue.loading}
          more={queue.more}
          hasMore={queue.page?.hasMore}
        />
      </Card>
      {editor && (
        <DecisionDialog
          title={editor.tag ? "Chỉnh sửa tag" : "Thêm tag"}
          description="Tag được lưu vào danh mục chung."
          confirmLabel="Lưu tag"
          withReason={!!editor.tag}
          min={editor.tag ? 1 : 0}
          max={2000}
          idempotent
          onClose={() => setEditor(null)}
          onReload={reload}
          onSubmit={async (reason) => {
            await command(
              editor.tag ? `tags/${editor.tag.id}` : "tags",
              editor.tag ? "PATCH" : "POST",
              {
                label: editor.label.trim(),
                ...(editor.tag
                  ? {
                      status: editor.status,
                      reason,
                      expectedVersion: editor.tag.version,
                    }
                  : {}),
              },
            );
            setSuccess("Đã lưu tag.");
            await reload();
          }}
        >
          <div className="stack">
            <label className="staff-field">
              <span>Tên tag</span>
              <input
                required
                maxLength={80}
                value={editor.label}
                onChange={(e) =>
                  setEditor({ ...editor, label: e.target.value })
                }
              />
            </label>
            {editor.tag && (
              <label className="staff-field">
                <span>Trạng thái</span>
                <select
                  value={editor.status}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      status: e.target.value as "ACTIVE" | "INACTIVE",
                    })
                  }
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                </select>
              </label>
            )}
          </div>
        </DecisionDialog>
      )}
    </>
  );
}

export function TagRequestsScreen() {
  const [status, setStatus] = useState("PENDING");
  const [selected, setSelected] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  const queue = useStaffList<TagRequest>(`tag-requests?${params}`);
  return (
    <>
      <PageHeader
        title="Đề xuất tag"
        desc="Duyệt đề xuất tag gửi riêng. Tag đi kèm yêu cầu học được duyệt ngay trong yêu cầu đó."
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
      <TagNavigation page="requests" />
      <label className="toolbar">
        <span>Trạng thái</span>
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Đã từ chối</option>
        </select>
      </label>
      {success && <output className="staff-success">{success}</output>}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={queue.reload}
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tag đề xuất</th>
                  <th>Người gửi</th>
                  <th>Trạng thái</th>
                  <th>Ngày gửi</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td className="mono">{item.requestedByUserId}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{fmtDateTime(item.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelected(item.id)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueueState>
        <Pager
          loading={queue.loading}
          more={queue.more}
          hasMore={queue.page?.hasMore}
        />
      </Card>
      {selected && (
        <TagRequestDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onComplete={async () => {
            setSelected(null);
            setSuccess("Đã ghi nhận quyết định duyệt tag.");
            await queue.reload();
          }}
        />
      )}
    </>
  );
}

function TagRequestDetail({
  id,
  onClose,
  onComplete,
}: Readonly<{
  id: string;
  onClose: () => void;
  onComplete: () => Promise<void>;
}>) {
  const resource = useStaffResource<TagRequest>(`tag-requests/${id}`);
  const command = useStaffCommand();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const item = resource.data;
  return (
    <Card
      className="section"
      title="Chi tiết đề xuất"
      actions={
        <button className="btn" onClick={onClose}>
          Đóng chi tiết
        </button>
      }
    >
      <QueueState
        loading={resource.loading}
        error={resource.error}
        empty={!item}
        reload={resource.reload}
      >
        {item && (
          <div className="stack">
            <h3>{item.label}</h3>
            <StatusBadge status={item.status} />
            <dl className="kv staff-kv">
              <dt>Người gửi</dt>
              <dd className="mono">{item.requestedByUserId}</dd>
              <dt>Ngày gửi</dt>
              <dd>{fmtDateTime(item.createdAt)}</dd>
              <dt>Người duyệt</dt>
              <dd className="mono">{item.reviewedByUserId ?? "Chưa duyệt"}</dd>
              <dt>Ngày duyệt</dt>
              <dd>
                {item.reviewedAt ? fmtDateTime(item.reviewedAt) : "Chưa duyệt"}
              </dd>
              {item.resultTagId && (
                <>
                  <dt>Tag đã tạo</dt>
                  <dd className="mono">{item.resultTagId}</dd>
                </>
              )}
            </dl>
            {item.rejectReason && (
              <p className="prose">Lý do từ chối: {item.rejectReason}</p>
            )}
            {item.status === "PENDING" && (
              <div className="row">
                <button
                  className="btn btn-primary"
                  onClick={() => setAction("approve")}
                >
                  Duyệt
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setAction("reject")}
                >
                  Từ chối
                </button>
              </div>
            )}
          </div>
        )}
      </QueueState>
      {item && action && (
        <DecisionDialog
          key={action}
          title={
            action === "approve" ? "Duyệt đề xuất tag" : "Từ chối đề xuất tag"
          }
          description={item.label}
          confirmLabel={action === "approve" ? "Duyệt tag" : "Từ chối"}
          danger={action === "reject"}
          withReason={action === "reject"}
          min={action === "reject" ? 1 : 0}
          max={2000}
          idempotent
          onClose={() => setAction(null)}
          onReload={resource.reload}
          onSubmit={async (reason) => {
            await command(`tag-requests/${id}/${action}`, "POST", {
              expectedVersion: item.version,
              ...(action === "reject" ? { reason } : {}),
            });
            await onComplete();
          }}
        />
      )}
    </Card>
  );
}
