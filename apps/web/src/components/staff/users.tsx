"use client";
import "./user-management.css";
import { useState } from "react";
import {
  Avatar,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { AdminUser } from "@/lib/staff/admin-types";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { Pager, QueueState } from "./common";
import { Icon } from "@/components/console/icon";
import { UserManagementDialog } from "./user-management-dialog";
import {
  allowedUserActions,
  type UserAction,
} from "@/lib/staff/user-management";
export function UsersScreen({
  initialUserId,
}: Readonly<{ initialUserId?: string }>) {
  const { actor } = useStaffSession();
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialUserId ?? null,
  );
  const [initialAction, setInitialAction] = useState<UserAction>();
  const [success, setSuccess] = useState<string | null>(null);
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (role) params.set("role", role);
  const queue = useStaffList<AdminUser>(`users?${params}`);
  const selected = queue.items.find((u) => u.userId === selectedId);
  const rows = queue.items.filter((u) =>
    `${u.fullName} ${u.maskedEmail} ${u.userId}`
      .toLocaleLowerCase("vi")
      .includes(q.trim().toLocaleLowerCase("vi")),
  );
  const reset = () => {
    setSelectedId(null);
    setInitialAction(undefined);
    setSuccess(null);
  };
  const reload = async () => {
    setSelectedId(null);
    setInitialAction(undefined);
    await queue.reload();
  };
  return (
    <>
      <PageHeader
        title="Người dùng"
        desc="Quản lý trạng thái tài khoản và phân quyền nhân viên."
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
          label="Tìm trong người dùng đã tải"
          placeholder="Tên, email đã che hoặc mã…"
          value={q}
          onChange={setQ}
        />
        <label>
          <span className="sr-only">Vai trò</span>
          <select
            className="select"
            value={role}
            onChange={(e) => {
              reset();
              setRole(e.target.value);
            }}
          >
            <option value="">Mọi vai trò</option>
            {["USER", "STAFF", "ADMIN"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Trạng thái</span>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              reset();
              setStatus(e.target.value);
            }}
          >
            <option value="">Mọi trạng thái</option>
            {[
              "ACTIVE",
              "LOCKED",
              "PENDING_VERIFICATION",
              "SUSPENDED",
              "DEACTIVATED",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
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
          reload={queue.reload}
        >
          {!rows.length ? (
            <Empty title="Không có kết quả trong danh sách đã tải" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={u.fullName || "Người dùng"} />
                          <div>
                            <strong>{u.fullName || "Chưa có tên"}</strong>
                            <span>{u.maskedEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {u.roles.map((r) => (
                          <StatusBadge key={r} status={r} />
                        ))}
                      </td>
                      <td>
                        <StatusBadge status={u.accountStatus} />
                      </td>
                      <td>{fmtDateTime(u.createdAt)}</td>
                      <td>
                        <div className="user-row-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            aria-label={`Quản lý ${u.fullName || u.maskedEmail}`}
                            onClick={() => {
                              setSelectedId(u.userId);
                              setInitialAction(undefined);
                              setSuccess(null);
                            }}
                          >
                            <Icon name="sliders" size={16} /> Quản lý
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={u.roles.includes("ADMIN")}
                            title={
                              u.roles.includes("ADMIN")
                                ? "Không thể thay đổi quyền Staff của Admin"
                                : undefined
                            }
                            aria-label={`${u.roles.includes("STAFF") ? "Gỡ" : "Cấp"} quyền Staff cho ${u.fullName || u.maskedEmail}`}
                            onClick={() => {
                              setSelectedId(u.userId);
                              setInitialAction(
                                u.roles.includes("STAFF") ? "remove" : "assign",
                              );
                              setSuccess(null);
                            }}
                          >
                            <Icon name="shield" size={16} />{" "}
                            {u.roles.includes("STAFF")
                              ? "Gỡ quyền Staff"
                              : "Cấp quyền Staff"}
                          </button>
                          {["ACTIVE", "LOCKED"].includes(u.accountStatus) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={
                                queue.loading ||
                                !allowedUserActions(u, actor?.userId).includes(
                                  u.accountStatus === "LOCKED"
                                    ? "unlock"
                                    : "lock",
                                )
                              }
                              title={
                                u.userId === actor?.userId
                                  ? "Bạn không thể tự khóa tài khoản đang sử dụng"
                                  : undefined
                              }
                              aria-label={`${u.accountStatus === "LOCKED" ? "Mở khóa" : "Khóa tài khoản"} ${u.fullName || u.maskedEmail}`}
                              onClick={() => {
                                const next =
                                  u.accountStatus === "LOCKED"
                                    ? "unlock"
                                    : "lock";
                                if (
                                  !allowedUserActions(
                                    u,
                                    actor?.userId,
                                  ).includes(next)
                                )
                                  return;
                                setSelectedId(u.userId);
                                setInitialAction(next);
                                setSuccess(null);
                              }}
                            >
                              <Icon
                                name={
                                  u.accountStatus === "LOCKED"
                                    ? "unlock"
                                    : "lock"
                                }
                                size={16}
                              />
                              {u.accountStatus === "LOCKED"
                                ? "Mở khóa"
                                : "Khóa tài khoản"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueueState>
        <div className="table-foot">
          {queue.items.length} người dùng đã tải · Tìm kiếm trong các trang đã
          tải
        </div>
        <Pager
          loading={queue.loading}
          more={queue.more}
          hasMore={queue.page?.hasMore}
        />
      </Card>
      {selectedId && !selected && !queue.loading && !queue.error && (
        <Card className="section">
          <p>
            Tài khoản được chọn chưa có trong danh sách đã tải. Tải thêm hoặc
            đổi bộ lọc để tìm tài khoản.
          </p>
          <Pager
            loading={queue.loading}
            more={queue.more}
            hasMore={queue.page?.hasMore}
          />
        </Card>
      )}
      {selected && !queue.error && (
        <UserManagementDialog
          key={`${actor?.userId}:${selected.userId}:${initialAction ?? "manage"}`}
          user={selected}
          initialAction={initialAction}
          onClose={() => {
            setSelectedId(null);
            setInitialAction(undefined);
          }}
          onReload={() => {
            void reload();
          }}
          onUpdated={(message) => {
            setSuccess(message);
            void reload();
          }}
        />
      )}
    </>
  );
}
