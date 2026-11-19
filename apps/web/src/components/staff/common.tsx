"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Empty } from "@/components/console/ui";
import { StaffApiError, isSessionFailure } from "@/lib/staff/client";
import { useStaffSession } from "./session";
import { DecisionErrorDialog } from "./decision-error-dialog";
import { LoadingSkeleton } from "@/components/loading-skeleton";
export function QueueState({
  loading,
  error,
  empty,
  reload,
  children,
  emptyTitle = "Hàng đợi trống",
  emptyDescription = "Chưa có mục nào cần xử lý ở trạng thái này.",
}: Readonly<{
  loading: boolean;
  error?: string;
  empty: boolean;
  reload: () => void;
  children: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}>) {
  if (error)
    return (
      <>
        <div className="staff-state">
          <p role="alert" className="staff-error">
            {!empty && "Đang hiển thị dữ liệu đã tải trước đó. "}
            {error}
          </p>
          <LoadingButton
            type="button"
            className="btn"
            onClick={reload}
            disabled={loading}
            loading={!!loading}
          >
            Thử lại
          </LoadingButton>
        </div>
        {!empty && children}
      </>
    );
  if (loading && empty) return <LoadingSkeleton variant="table" />;
  if (empty) return <Empty title={emptyTitle} desc={emptyDescription} />;
  if (loading)
    return (
      <>
        <LoadingSkeleton variant="inline" label="Đang cập nhật dữ liệu" />
        {children}
      </>
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
      <LoadingButton
        type="button"
        className="btn"
        onClick={more}
        disabled={loading}
        loading={!!loading}
      >
        {loading ? "Đang tải…" : "Tải thêm"}
      </LoadingButton>
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
  presentation = "modal",
  submitDisabled = false,
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
  presentation?: "modal" | "drawer";
  submitDisabled?: boolean;
}>) {
  const { expire } = useStaffSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const attempt = useRef<{ text: string; key: string } | null>(null);
  const flight = useRef(false);
  const invalidField = useRef<HTMLElement | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mustReload, setMustReload] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    if (presentation === "drawer") {
      heading.current?.focus({ preventScroll: true });
      if (dialog.current) dialog.current.scrollTop = 0;
    } else area.current?.focus();
  }, [presentation]);
  return (
    <dialog
      ref={dialog}
      className={`dialog${presentation === "drawer" ? " ops-decision-drawer" : ""}`}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (!flight.current) onClose();
      }}
    >
      <form
        className="staff-dialog"
        onInvalid={(event) => {
          event.preventDefault();
          const field = event.target;
          if (!(
            field instanceof HTMLInputElement ||
            field instanceof HTMLSelectElement ||
            field instanceof HTMLTextAreaElement
          ))
            return;
          if (invalidField.current) return;
          invalidField.current = field;
          const details = field.closest("details");
          if (details) details.open = true;
          const label =
            field.getAttribute("aria-label") ??
            field.labels?.[0]?.textContent?.trim() ??
            "thông tin bắt buộc";
          setError(
            `Vui lòng kiểm tra ${label.toLocaleLowerCase("vi")}. ${field.validity.valueMissing ? "Bạn chưa nhập hoặc chọn thông tin này." : "Giá trị chưa đúng định dạng hoặc ngoài giới hạn cho phép."}`,
          );
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (flight.current || mustReload || submitDisabled) return;
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
              ((err.status === 409 &&
                ![
                  "USER_MAKEUP_LIMIT_REACHED",
                  "SESSION_MAKEUP_LIMIT_REACHED",
                  "MAKEUP_ATTRIBUTION_REVIEW_REQUIRED",
                  "MAKEUP_USER_REQUIRED",
                  "MAKEUP_USER_NOT_PARTICIPANT",
                  "INSUFFICIENT_AVAILABLE_CREDIT",
                ].includes(err.code)) ||
                (!idempotent &&
                  (err.status === 0 ||
                    err.status === 408 ||
                    err.status >= 500)))
            )
              setMustReload(true);
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        {presentation === "drawer" && (
          <LoadingButton
            type="button"
            className="icon-btn ops-drawer-close"
            aria-label="Đóng hộp thoại"
            disabled={busy}
            onClick={onClose}
            loading={!!busy}
          >
            ×
          </LoadingButton>
        )}
        <span className={`badge badge-${danger ? "bad" : "brand"}`}>
          XÁC NHẬN THAO TÁC
        </span>
        <h2
          ref={heading}
          tabIndex={presentation === "drawer" ? -1 : undefined}
          id={`${id}-title`}
        >
          {title}
        </h2>
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
        <div className="staff-dialog-actions">
          <LoadingButton
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
            loading={!!busy}
          >
            Hủy
          </LoadingButton>
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
            <LoadingButton
              type="submit"
              className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
              disabled={busy || submitDisabled}
              loading={!!busy}
            >
              {busy ? "Đang gửi…" : confirmLabel}
            </LoadingButton>
          )}
        </div>
      </form>
      {error && (
        <DecisionErrorDialog
          message={error}
          requiresReload={mustReload}
          onClose={() => {
            setError(null);
            const field = invalidField.current;
            invalidField.current = null;
            requestAnimationFrame(() => field?.focus({ preventScroll: true }));
          }}
          onReload={() => {
            onReload();
            onClose();
          }}
        />
      )}
    </dialog>
  );
}
