"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/console/icon";

export function RecordId({
  id,
  label = "mã",
}: Readonly<{ id: string; label?: string }>) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="admin-record-id">
      <span className="mono" title={id}>
        {id.length > 16 ? id.slice(0, 8) + "…" + id.slice(-4) : id}
      </span>
      <button
        type="button"
        className="admin-copy-button"
        aria-label={`Sao chép ${label} ${id}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? (
          <Icon name="check" size={14} />
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V4H4v12h4" />
          </svg>
        )}
      </button>
      {copied && (
        <span className="sr-only" role="status">
          Đã sao chép {label}.
        </span>
      )}
      {failed && (
        <span className="admin-copy-error" role="alert">
          Chưa sao chép được. Bạn có thể chọn mã để sao chép thủ công.
        </span>
      )}
    </span>
  );
}

export function AdminField({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="admin-field">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function AdminNotice({
  children,
  tone = "info",
}: Readonly<{ children: ReactNode; tone?: "info" | "warn" | "bad" }>) {
  return (
    <div
      className={`admin-notice admin-notice-${tone}`}
      role={tone === "bad" ? "alert" : undefined}
    >
      <Icon name="alert" size={18} />
      <div>{children}</div>
    </div>
  );
}

export function AdminDrawer({
  title,
  subtitle,
  children,
  footer,
  close,
  busy = false,
  wide = false,
}: Readonly<{
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  close: () => void;
  busy?: boolean;
  wide?: boolean;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
        requestAnimationFrame(() => {
          if (document.activeElement === document.body && previous.isConnected)
            previous.focus({ preventScroll: true });
        });
      }
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`admin-drawer ${wide ? "admin-drawer-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          dialog.current?.close();
          close();
        }
      }}
    >
      <header className="admin-drawer-header">
        <div>
          <h2 ref={heading} id={titleId} tabIndex={-1}>
            {title}
          </h2>
          {subtitle && <div className="admin-drawer-subtitle">{subtitle}</div>}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Đóng chi tiết"
          disabled={busy}
          onClick={close}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="admin-drawer-body">{children}</div>
      {footer && <footer className="admin-drawer-footer">{footer}</footer>}
    </dialog>
  );
}
