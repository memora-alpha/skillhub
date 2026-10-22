"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar, Badge, StatusBadge } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { fmtDateTime } from "@/lib/console/format";
import type { AdminUser } from "@/lib/staff/admin-types";
import { isSessionFailure, StaffApiError } from "@/lib/staff/client";
import {
  allowedUserActions,
  manageUser,
  userActionLabels,
  type UserAction,
} from "@/lib/staff/user-management";
import { useStaffSession } from "./session";

export function UserManagementDialog({
  user,
  initialAction,
  onClose,
  onUpdated,
  onReload,
}: Readonly<{
  user: AdminUser;
  initialAction?: UserAction;
  onClose: () => void;
  onUpdated: (message: string) => void;
  onReload: () => void;
}>) {
  const { api, actor, expire } = useStaffSession();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const flight = useRef(false);
  const [action, setAction] = useState<UserAction | undefined>(initialAction);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [mustReload, setMustReload] = useState(false);
  const allowed = allowedUserActions(user, actor?.userId);
  const roleChange = action === "assign" || action === "remove";
  const title = action ? userActionLabels[action] : "Quản lý người dùng";
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    if (!element?.open) element?.showModal();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  function choose(next: UserAction | undefined) {
    if (flight.current || mustReload) return;
    setAction(next);
    setReason("");
    setPassword("");
    setError(undefined);
  }
  return (
    <dialog
      ref={dialog}
      className="dialog user-management-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        if (!flight.current) onClose();
      }}
    >
      <div className="user-dialog-content">
        <div className="dialog-head">
          <h2 id={`${id}-title`}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Đóng thông tin người dùng"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="user-dialog-identity">
          <Avatar name={user.fullName || "Người dùng"} />
          <div>
            <h3>{user.fullName || "Chưa có tên"}</h3>
            <p className="muted">{user.maskedEmail}</p>
          </div>
        </div>
        <div className="row">
          <StatusBadge status={user.accountStatus} />
          {user.roles.map((role) => (
            <StatusBadge key={role} status={role} />
          ))}
          {user.userId === actor?.userId && <Badge>Tài khoản của bạn</Badge>}
        </div>
        <dl className="kv staff-kv user-dialog-details">
          <dt>Mã tài khoản</dt>
          <dd className="mono">{user.userId}</dd>
          <dt>Ngày tạo</dt>
          <dd>{fmtDateTime(user.createdAt)}</dd>
        </dl>
        {!action ? (
          <section
            className="user-dialog-section"
            aria-label="Thao tác quản lý"
          >
            <h3>Thao tác quản lý</h3>
            <div className="user-row-actions">
              {allowed.map((next) => (
                <button
                  key={next}
                  type="button"
                  className="btn"
                  onClick={() => choose(next)}
                >
                  <Icon
                    name={
                      next === "lock"
                        ? "lock"
                        : next === "unlock"
                          ? "unlock"
                          : "shield"
                    }
                    size={16}
                  />
                  {userActionLabels[next]}
                </button>
              ))}
            </div>
            {!allowed.length && (
              <p className="muted">
                Không có thao tác khả dụng cho tài khoản này.
              </p>
            )}
            {user.userId === actor?.userId && (
              <p className="muted">
                Bạn không thể tự khóa tài khoản đang sử dụng.
              </p>
            )}
          </section>
        ) : (
          <form
            className="user-action-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (flight.current || mustReload || !allowed.includes(action))
                return;
              const trimmed = reason.trim();
              if (!trimmed || Array.from(trimmed).length > 1000) {
                setError("Nhập lý do từ 1 đến 1.000 ký tự.");
                return;
              }
              flight.current = true;
              setBusy(true);
              setError(undefined);
              try {
                await manageUser(api, user.userId, action, trimmed, password);
                setPassword("");
                onUpdated(
                  `${userActionLabels[action]} cho ${user.fullName || user.maskedEmail} thành công.`,
                );
              } catch (failure) {
                setPassword("");
                if (isSessionFailure(failure)) expire();
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Không thể cập nhật tài khoản.",
                );
                if (
                  failure instanceof StaffApiError &&
                  (failure.status === 409 ||
                    failure.status === 0 ||
                    failure.status >= 500)
                )
                  setMustReload(true);
              } finally {
                flight.current = false;
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              {action === "lock"
                ? "Tài khoản sẽ bị khóa và các phiên đăng nhập sẽ bị thu hồi."
                : action === "unlock"
                  ? "Người dùng có thể đăng nhập lại sau khi tài khoản được mở khóa."
                  : "Nhập mật khẩu Admin để xác nhận thay đổi quyền của tài khoản này."}
            </p>
            <fieldset
              className="portal-fields user-action-fields"
              disabled={busy || mustReload}
            >
              <label className="staff-field" htmlFor={`${id}-reason`}>
                <span>
                  Lý do <span aria-hidden="true">*</span>
                </span>
                <textarea
                  id={`${id}-reason`}
                  required
                  maxLength={1000}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {roleChange && (
                <label className="staff-field" htmlFor={`${id}-password`}>
                  <span>
                    Mật khẩu Admin <span aria-hidden="true">*</span>
                  </span>
                  <input
                    id={`${id}-password`}
                    type="password"
                    required
                    autoComplete="current-password"
                    maxLength={64}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              )}
            </fieldset>
            {error && (
              <p className="staff-error" role="alert">
                {error}
              </p>
            )}
            <div className="staff-dialog-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => (mustReload ? onClose() : choose(undefined))}
              >
                Quay lại
              </button>
              {mustReload ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onReload}
                >
                  Tải lại dữ liệu
                </button>
              ) : (
                <button
                  type="submit"
                  className={`btn ${action === "lock" || action === "remove" ? "btn-danger" : "btn-primary"}`}
                  disabled={busy || !allowed.includes(action)}
                >
                  {busy ? "Đang cập nhật…" : userActionLabels[action]}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
