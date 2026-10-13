"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Empty } from "@/components/console/ui";
import { StaffApiError, isSessionFailure } from "@/lib/staff/client";
import { useStaffSession } from "./session";
export function QueueState({
  loading,
  error,
  empty,
  reload,
  children,
}: Readonly<{
  loading: boolean;
  error?: string;
  empty: boolean;
  reload: () => void;
  children: ReactNode;
}>) {
  if (error)
    return (
      <div className="staff-state">
        <p role="alert" className="staff-error">
          {error}
        </p>
        <button type="button" className="btn" onClick={reload}>
          Thử lại
        </button>
      </div>
    );
  if (loading && empty)
    return <output className="staff-state">Đang tải hàng đợi…</output>;
  if (empty)
    return (
      <Empty
        title="Hàng đợi trống"
        desc="Chưa có mục nào cần xử lý ở trạng thái này."
      />
    );
  return children;
}
export function Pager({
  loading,
  more,
  hasMore,
}: Readonly<{
  loading: boolean;
  more: () => void;
  hasMore?: boolean;
}>) {
  return hasMore ? (
    <div className="staff-pager">
      <button type="button" className="btn" onClick={more} disabled={loading}>
        {loading ? "Đang tải…" : "Tải thêm"}
      </button>
    </div>
  ) : null;
}
export { EvidenceFileButton as DownloadButton } from "./file-preview";
export function DecisionDialog({
  title,
  description,
  label = "Lý do",
  min = 0,
  max,
  confirmLabel,
  danger = false,
  onSubmit,
  onClose,
  onReload,
  idempotent = false,
  children,
  withReason = true,
}: Readonly<{
  title: string;
  description: string;
  label?: string;
  min?: number;
  max?: number;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (text: string, key: string) => Promise<void>;
  onClose: () => void;
  onReload: () => void;
  idempotent?: boolean;
  children?: ReactNode;
  withReason?: boolean;
}>) {
  const { expire } = useStaffSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const attempt = useRef<{ text: string; key: string } | null>(null);
  const flight = useRef(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mustReload, setMustReload] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    area.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (!flight.current) onClose();
      }}
    >
      <form
        className="staff-dialog"
        onSubmit={async (e) => {
          e.preventDefault();
          if (flight.current || mustReload) return;
          const trimmed = text.trim(),
            length = Array.from(trimmed).length;
          if (length < min || (max !== undefined && length > max)) {
            const constraint =
              max === undefined
                ? `${min} ký tự trở lên`
                : `${min}–${max} ký tự`;
            setError(`Nội dung cần ${constraint}.`);
            area.current?.focus();
            return;
          }
          if (attempt.current?.text !== trimmed)
            attempt.current = { text: trimmed, key: crypto.randomUUID() };
          flight.current = true;
          setBusy(true);
          setError(null);
          try {
            await onSubmit(trimmed, attempt.current!.key);
            onClose();
          } catch (err) {
            if (isSessionFailure(err)) expire();
            setError(
              err instanceof Error ? err.message : "Không thể lưu quyết định.",
            );
            if (
              err instanceof StaffApiError &&
              (err.status === 409 ||
                (!idempotent && (err.status === 0 || err.status >= 500)))
            )
              setMustReload(true);
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        <span className={`badge badge-${danger ? "bad" : "brand"}`}>
          XÁC NHẬN THAO TÁC
        </span>
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="muted">{description}</p>
        {children && (
          <fieldset className="portal-fields" disabled={busy || mustReload}>
            {children}
          </fieldset>
        )}
        {withReason && (
          <label className="staff-field" htmlFor={`${id}-note`}>
            {label}
            {min > 0 ? " *" : " (không bắt buộc)"}
            <textarea
              id={`${id}-note`}
              ref={area}
              rows={4}
              value={text}
              disabled={busy || mustReload}
              maxLength={max}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        )}
        {withReason && (
          <div className="staff-note-count muted">
            {Array.from(text.trim()).length}
            {max !== undefined ? `/${max}` : ""} ký tự
          </div>
        )}
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
            onClick={onClose}
          >
            Hủy
          </button>
          {mustReload ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onReload();
                onClose();
              }}
            >
              Tải lại dữ liệu
            </button>
          ) : (
            <button
              type="submit"
              className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
              disabled={busy}
            >
              {busy ? "Đang gửi…" : confirmLabel}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
