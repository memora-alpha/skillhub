"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Icon } from "@/components/console/icon";
import { createStaffAccount } from "@/lib/staff/create-staff";
import { isSessionFailure, StaffApiError } from "@/lib/staff/client";
import { useStaffSession } from "./session";

export function CreateStaffDialog({
  onClose,
  onCreated,
  onCheck,
}: Readonly<{
  onClose: () => void;
  onCreated: () => void;
  onCheck: () => void;
}>) {
  const { api, expire } = useStaffSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const flight = useRef(false);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="dialog user-management-dialog staff-create-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        if (!flight.current) onClose();
      }}
    >
      <form
        className="user-dialog-content"
        onSubmit={async (event) => {
          event.preventDefault();
          if (flight.current || uncertain) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          const value = (key: string) => {
            const field = data.get(key);
            return typeof field === "string" ? field : "";
          };
          flight.current = true;
          setBusy(true);
          setError("");
          try {
            await createStaffAccount(
              api,
              {
                fullName: value("fullName"),
                email: value("email"),
                password: value("password"),
                confirmPassword: value("confirmPassword"),
              },
              value("adminPassword"),
            );
            form.reset();
            onCreated();
          } catch (cause) {
            if (isSessionFailure(cause)) {
              expire();
              return;
            }
            const unknown =
              cause instanceof StaffApiError &&
              (cause.status === 0 ||
                cause.status >= 500 ||
                cause.code === "SESSION_RETRY_REQUIRED");
            if (unknown) {
              form.reset();
              setUncertain(true);
              setError(
                "Chưa xác định được kết quả. Kiểm tra danh sách người dùng trước khi tạo lại để tránh tạo trùng.",
              );
            } else
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Không tạo được tài khoản Staff.",
              );
          } finally {
            const password = form.elements.namedItem("adminPassword");
            if (password instanceof HTMLInputElement) password.value = "";
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        <div className="dialog-head">
          <h2 id={`${id}-title`}>Tạo tài khoản Staff</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Đóng tạo tài khoản Staff"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        <p className="muted">
          Tài khoản được kích hoạt ngay và có quyền Staff. Kiểm tra đúng email
          của nhân viên trước khi tạo.
        </p>
        {!uncertain && (
          <fieldset
            disabled={busy}
            className="user-action-fields staff-create-fields"
          >
            <label className="field">
              <span>Họ và tên</span>
              <input
                className="input"
                name="fullName"
                required
                minLength={2}
                maxLength={100}
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Email nhân viên</span>
              <input
                className="input"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Mật khẩu Staff</span>
              <PasswordInput
                className="input"
                name="password"
                required
                minLength={8}
                maxLength={64}
                autoComplete="new-password"
                visibilityLabel="mật khẩu Staff"
              />
            </label>
            <p className="muted">
              8–64 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
            </p>
            <label className="field">
              <span>Nhập lại mật khẩu Staff</span>
              <PasswordInput
                className="input"
                name="confirmPassword"
                required
                minLength={8}
                maxLength={64}
                autoComplete="new-password"
                visibilityLabel="mật khẩu Staff nhập lại"
              />
            </label>
            <label className="field">
              <span>Mật khẩu Admin của bạn</span>
              <PasswordInput
                className="input"
                name="adminPassword"
                required
                maxLength={64}
                autoComplete="current-password"
                visibilityLabel="mật khẩu Admin"
              />
            </label>
          </fieldset>
        )}
        {!!error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
        <div className="staff-dialog-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Đóng
          </button>
          {uncertain ? (
            <button type="button" className="btn btn-primary" onClick={onCheck}>
              Kiểm tra danh sách
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Đang tạo…" : "Xác nhận tạo Staff"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
