"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import "./user-management.css";
import Link from "next/link";
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
import { financeNumber } from "@/lib/staff/finance-presentation";
import type { AdminUser } from "@/lib/staff/admin-types";
import {
  filterLoadedUsers,
  userCreatedDateError,
  userRoles,
  userStatuses,
} from "@/lib/staff/user-list-filters";

import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { StaffUserProfile } from "./user-profile";
import { QueueState } from "./common";
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
  const queue = useStaffListPages<AdminUser>(`users?${params}`);
  const selected = queue.allItems.find((u) => u.userId === selectedId);
  const dateError = userCreatedDateError(createdFrom, createdTo);
  const rows = filterLoadedUsers(queue.items, q, createdFrom, createdTo);
  const activeFilterCount = [role, status, createdFrom, createdTo].filter(
    Boolean,
  ).length;
  const reset = () => {
    setSelectedId(null);
    setInitialAction(undefined);
    setSuccess(null);
  };
  const clearFilters = () => {
    reset();
    setQ("");
    setRole("");
    setStatus("");
    setCreatedFrom("");
    setCreatedTo("");
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
            <LoadingButton
              type="button"
              className="btn"
              disabled={queue.loading}
              onClick={reload}
              loading={!!queue.loading}
            >
              Làm mới
            </LoadingButton>
          </div>
        }
      />
      <AdminFilterPanel
        activeCount={activeFilterCount}
        onClear={clearFilters}
        lead={
          <SearchBox
            label="Tìm trong trang người dùng hiện tại"
            placeholder="Tìm theo tên, email đã che hoặc mã…"
            value={q}
            onChange={setQ}
          />
        }
      >
        <div className={filterPanelStyles.grid}>
          <label className={filterPanelStyles.field}>
            <span>Vai trò</span>
            <select
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
          <label className={filterPanelStyles.field}>
            <span>Trạng thái</span>
            <select
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
          <label className={filterPanelStyles.field}>
            <span>Tạo từ ngày (GMT+7)</span>
            <input
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
          <label className={filterPanelStyles.field}>
            <span>Tạo đến ngày (GMT+7)</span>
            <input
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
          <div className={filterPanelStyles.footer}>
            <p className={filterPanelStyles.note} id="user-filter-scope">
              Vai trò & trạng thái lọc toàn hệ thống; tìm kiếm & ngày tạo áp
              dụng cho trang hiện tại.
            </p>
          </div>
        </div>
      </AdminFilterPanel>
      {dateError && (
        <p className="staff-error" id="user-date-error" role="alert">
          {dateError}
        </p>
      )}
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
                  : "Không có kết quả trong trang hiện tại"
              }
              desc={
                dateError ||
                (queue.page?.hasMore
                  ? "Thử đổi bộ lọc hoặc chuyển sang trang khác."
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
                            <LoadingButton
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
                              loading={!!queue.loading}
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
                            </LoadingButton>
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
        {dateError && <div className="table-foot">Khoảng ngày chưa hợp lệ</div>}
        <ListPagination query={queue} />
      </Card>
      {selectedId && !selected && !queue.loading && !queue.error && (
        <DirectUserLookupDrawer
          userId={selectedId}
          onClose={() => {
            setSelectedId(null);
            setInitialAction(undefined);
          }}
        />
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

type WalletSnapshot = {
  availableCredit: string;
  heldCredit: string;
  walletVersion: number;
};

function DirectUserLookupDrawer({
  userId,
  onClose,
}: Readonly<{ userId: string; onClose: () => void }>) {
  const validUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
    userId,
  );
  const wallet = useStaffResource<WalletSnapshot>(`users/${userId}/wallet`, {
    enabled: validUuid,
  });

  return (
    <AdminDrawer
      wide
      title="Tra cứu nhanh tài khoản"
      subtitle={<RecordId id={userId} label="người dùng" />}
      close={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {!validUuid ? (
        <AdminNotice tone="bad">
          Mã tài khoản trên đường dẫn không đúng định dạng UUID.
        </AdminNotice>
      ) : (
        <div className="stack">
          <AdminNotice tone="info">
            Tài khoản này nằm ngoài trang danh sách hiện tại. Bạn vẫn có thể xem
            hồ sơ công khai, số dư ví Credit và đi tới các màn hình quản trị
            liên quan. Để khóa/mở khóa hoặc đổi vai trò, hãy chuyển trang hoặc
            lọc theo vai trò/trạng thái trong bảng danh sách.
          </AdminNotice>

          <section className="admin-section">
            <h3>Liên kết quản trị nhanh</h3>
            <div className="row">
              <Link
                className="btn btn-sm"
                href={`/admin/profile-moderation?view=profile&userId=${userId}`}
              >
                Kiểm duyệt hồ sơ
              </Link>
              <Link
                className="btn btn-sm"
                href={`/admin/credits?tab=wallet&userId=${userId}`}
              >
                Xem ví Credit
              </Link>
              <Link
                className="btn btn-sm"
                href={`/admin/credits?tab=ledger&userId=${userId}`}
              >
                Lịch sử giao dịch Credit
              </Link>
              <Link
                className="btn btn-sm"
                href={`/admin/staff-permissions?userId=${userId}`}
              >
                Quyền nhân viên (nếu là Staff)
              </Link>
            </div>
          </section>

          <section className="admin-section">
            <h3>Số dư ví Credit</h3>
            <QueueState
              loading={wallet.loading}
              error={wallet.error}
              empty={!wallet.data}
              reload={wallet.reload}
            >
              {wallet.data && (
                <div className="admin-summary-strip">
                  <AdminField label="Credit khả dụng">
                    <strong className="admin-money">
                      {financeNumber(wallet.data.availableCredit)} CR
                    </strong>
                  </AdminField>
                  <AdminField label="Credit đang giữ (Held)">
                    <strong className="admin-money">
                      {financeNumber(wallet.data.heldCredit)} CR
                    </strong>
                  </AdminField>
                  <AdminField label="Phiên bản ví">
                    v{wallet.data.walletVersion}
                  </AdminField>
                </div>
              )}
            </QueueState>
          </section>

          <section className="admin-section">
            <h3>Hồ sơ công khai</h3>
            <StaffUserProfile userId={userId} />
          </section>
        </div>
      )}
    </AdminDrawer>
  );
}
