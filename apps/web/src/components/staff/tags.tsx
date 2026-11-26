"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import { useState } from "react";
import {
  DataTable,
  Card,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { AdminTag, TagRequest } from "@/lib/staff/admin-types";
import { useStaffCommand, useStaffResource } from "./hooks";
import { AdminDrawer, AdminField, RecordId } from "./admin-ui";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { UserProfileReference } from "./user-profile-reference";
import { DecisionDialog, QueueState } from "./common";

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
  const queue = useStaffListPages<AdminTag>(`tags?${params}`);
  const reload = () => {
    setEditor(null);
    return queue.reload();
  };
  return (
    <>
      <PageHeader
        title="Tag cộng đồng"
        desc="Quản lý tag dùng cho tìm kiếm và yêu cầu học."
        actions={
          <div className="row">
            <LoadingButton
              type="button"
              className="btn"
              disabled={queue.loading}
              onClick={reload}
              loading={!!queue.loading}
            >
              Làm mới
            </LoadingButton>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditor({ label: "", status: "ACTIVE" })}
            >
              Thêm tag
            </button>
          </div>
        }
      />
      <AdminFilterPanel
        activeCount={status ? 1 : 0}
        onClear={() => setStatus("")}
        lead={
          <SearchBox
            label="Tìm tag"
            placeholder="Tìm theo tên tag…"
            value={q}
            onChange={setQ}
            onSearch={setSearch}
          />
        }
      >
        <div className={filterPanelStyles.grid}>
          <label className={filterPanelStyles.field}>
            <span>Trạng thái tag</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm ngưng</option>
              <option value="ARCHIVED">Đã lưu trữ</option>
            </select>
          </label>
        </div>
      </AdminFilterPanel>
      {success && <output className="staff-success">{success}</output>}
      <Card flush className="ops-tag-table">
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={reload}
        >
          <DataTable columns={["Tag", "Trạng thái", "Cập nhật", "Thao tác"]}>
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
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setEditor({
                          tag,
                          label: tag.label,
                          status:
                            tag.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                        })
                      }
                    >
                      Sửa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueueState>
        <ListPagination query={queue} />
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

export function TagRequestsScreen({
  initialRequestId,
}: Readonly<{ initialRequestId?: string }>) {
  const [status, setStatus] = useState("PENDING");
  const [selected, setSelected] = useState<string | null>(() =>
    initialRequestId &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(initialRequestId)
      ? initialRequestId
      : null,
  );
  const [success, setSuccess] = useState("");
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  const queue = useStaffListPages<TagRequest>(`tag-requests?${params}`);
  return (
    <>
      <PageHeader
        title="Đề xuất tag"
        desc="Duyệt đề xuất tag gửi riêng. Tag đi kèm yêu cầu học được duyệt ngay trong yêu cầu đó."
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
          <DataTable
            columns={[
              "Tag đề xuất",
              "Người gửi",
              "Trạng thái",
              "Ngày gửi",
              "Thao tác",
            ]}
          >
            {queue.items.map((item) => (
              <tr key={item.id}>
                <td data-label="Tag đề xuất">
                  <strong>{item.label}</strong>
                </td>
                <td data-label="Người gửi">
                  <UserProfileReference
                    userId={item.requestedByUserId}
                    label="người gửi"
                  />
                </td>
                <td data-label="Trạng thái">
                  <StatusBadge status={item.status} />
                </td>
                <td data-label="Ngày gửi">{fmtDateTime(item.createdAt)}</td>
                <td data-label="Thao tác">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSelected(item.id)}
                  >
                    Xem chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueueState>
        <ListPagination query={queue} />
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
    <AdminDrawer
      title={item ? `Đề xuất tag: ${item.label}` : "Chi tiết đề xuất tag"}
      subtitle={<RecordId id={id} label="đề xuất tag" />}
      close={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          {item?.status === "PENDING" && (
            <>
              <button
                type="button"
                className="btn admin-danger-outline"
                onClick={() => setAction("reject")}
              >
                Từ chối
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAction("approve")}
              >
                Duyệt vào danh mục
              </button>
            </>
          )}
        </>
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
            <div className="row">
              <StatusBadge status={item.status} />
            </div>
            <div className="admin-field-grid">
              <AdminField label="Tên tag đề xuất">
                <strong>{item.label}</strong>
              </AdminField>
              <AdminField label="Người gửi">
                <UserProfileReference
                  userId={item.requestedByUserId}
                  label="người gửi"
                />
              </AdminField>
              <AdminField label="Ngày gửi">
                {fmtDateTime(item.createdAt)}
              </AdminField>
              <AdminField label="Người duyệt">
                {item.reviewedByUserId ? (
                  <UserProfileReference
                    userId={item.reviewedByUserId}
                    label="người duyệt"
                  />
                ) : (
                  "Chưa duyệt"
                )}
              </AdminField>
              <AdminField label="Ngày duyệt">
                {item.reviewedAt ? fmtDateTime(item.reviewedAt) : "Chưa duyệt"}
              </AdminField>
              {item.resultTagId && (
                <AdminField label="Tag đã tạo">
                  <RecordId id={item.resultTagId} label="tag" />
                </AdminField>
              )}
            </div>
            {item.rejectReason && (
              <div className="admin-reason">
                <strong>Lý do từ chối:</strong> {item.rejectReason}
              </div>
            )}
          </div>
        )}
      </QueueState>
      {item && action && (
        <DecisionDialog
          key={action}
          presentation="drawer"
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
    </AdminDrawer>
  );
}
