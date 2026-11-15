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
import {
  filterLoadedUsers,
  userCreatedDateError,
  userRoles,
  userStatuses,
} from "@/lib/staff/user-list-filters";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { Pager, QueueState } from "./common";
import { Icon } from "@/components/console/icon";
import { UserManagementDialog } from "./user-management-dialog";
import { CreateStaffDialog } from "./create-staff-dialog";
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
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialUserId ?? null,
  );
  const [initialAction, setInitialAction] = useState<UserAction>();
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (role) params.set("role", role);
  const queue = useStaffList<AdminUser>(`users?${params}`);
  const selected = queue.items.find((u) => u.userId === selectedId);
  const dateError = userCreatedDateError(createdFrom, createdTo);
  const rows = filterLoadedUsers(queue.items, q, createdFrom, createdTo);
  const hasFilters = Boolean(q || role || status || createdFrom || createdTo);
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
          <div className="row">
            {actor?.roles.includes("ADMIN") && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  reset();
                  setCreating(true);
                }}
              >
                Tạo tài khoản nhân viên
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={queue.loading}
              onClick={reload}
            >
              Làm mới
            </button>
          </div>
        }
      />
      <section className="user-list-filters" aria-label="Lọc người dùng">
        <div className="toolbar user-list-main-filters">
          <SearchBox
            label="Tìm trong người dùng đã tải"
            placeholder="Tên, email đã che hoặc mã…"
            value={q}
            onChange={setQ}
          />
          <label>
            <span>Vai trò</span>
            <select
              className="select"
              value={role}
              onChange={(e) => {
                reset();
                setRole(e.target.value);
              }}
            >
              <option value="">Mọi vai trò</option>
              {userRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Trạng thái</span>
            <select
              className="select"
              value={status}
              onChange={(e) => {
                reset();
                setStatus(e.target.value);
              }}
            >
              <option value="">Mọi trạng thái</option>
              {userStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="user-list-date-row">
          <fieldset
            className="user-list-date-range"
            aria-describedby="user-filter-scope"
          >
            <legend>Ngày tạo tài khoản · GMT+7</legend>
            <label>
              <span>Từ ngày</span>
              <input
                className="input"
                type="date"
                value={createdFrom}
                max={createdTo || undefined}
                aria-invalid={!!dateError}
                aria-describedby={dateError ? "user-date-error" : undefined}
                onChange={(event) => {
                  reset();
                  setCreatedFrom(event.target.value);
                }}
              />
            </label>
            <label>
              <span>Đến ngày</span>
              <input
                className="input"
                type="date"
                value={createdTo}
                min={createdFrom || undefined}
                aria-invalid={!!dateError}
                aria-describedby={dateError ? "user-date-error" : undefined}
                onChange={(event) => {
                  reset();
                  setCreatedTo(event.target.value);
                }}
              />
            </label>
          </fieldset>
          {hasFilters && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                reset();
                setQ("");
                setRole("");
                setStatus("");
                setCreatedFrom("");
                setCreatedTo("");
              }}
            >
              Bỏ bộ lọc
            </button>
          )}
        </div>
        <p className="user-filter-scope" id="user-filter-scope">
          Tìm kiếm và ngày tạo áp dụng cho các trang đã tải. Vai trò và trạng
          thái lọc toàn bộ danh sách.
        </p>
        {dateError && (
          <p className="staff-error" id="user-date-error" role="alert">
            {dateError}
          </p>
        )}
      </section>
      {success && <output className="staff-success">{success}</output>}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={queue.reload}
        >
          {!rows.length ? (
            <Empty
              title={
                dateError
                  ? "Chọn lại khoảng ngày"
                  : "Không có kết quả trong danh sách đã tải"
              }
              desc={
                dateError ||
                (queue.page?.hasMore
                  ? "Thử đổi bộ lọc hoặc tải thêm người dùng bên dưới."
                  : "Thử đổi bộ lọc để xem người dùng khác.")
              }
            />
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
                                ? "Không thể thay đổi quyền nhân viên của quản trị viên"
                                : undefined
                            }
                            aria-label={`${u.roles.includes("STAFF") ? "Gỡ" : "Cấp"} quyền nhân viên cho ${u.fullName || u.maskedEmail}`}
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
                              ? "Gỡ quyền nhân viên"
                              : "Cấp quyền nhân viên"}
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
          {dateError
            ? "Khoảng ngày chưa hợp lệ"
            : `${rows.length} kết quả trong ${queue.items.length} người dùng đã tải`}
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
      {creating && (
        <CreateStaffDialog
          key={actor?.userId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setSuccess(
              "Đã tạo tài khoản nhân viên. Nhân viên có thể đăng nhập ngay.",
            );
            void reload();
          }}
          onCheck={() => {
            setCreating(false);
            setRole("");
            setStatus("");
            setQ("");
            setCreatedFrom("");
            setCreatedTo("");
            void reload();
          }}
        />
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
