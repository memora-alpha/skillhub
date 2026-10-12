"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

const MIN = 10;
const MAX = 500;

/**
 * Modal that forces a written reason before a sensitive action (reject, lock, adjust, resolve…).
 * Mount it only while the action is pending; unmounting discards the draft.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  tone = "primary",
  label = "Lý do",
  help = "Bắt buộc. Lý do được ghi vào Audit log và có thể được gửi tới người dùng.",
  withReason = true,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  label?: string;
  help?: string;
  /** false turns this into a plain form dialog (no reason field, no validation here). */
  withReason?: boolean;
  children?: ReactNode;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const length = Array.from(reason.trim()).length;
  const error = !withReason
    ? null
    : length < MIN
      ? `Cần tối thiểu ${MIN} ký tự (hiện ${length}).`
      : length > MAX
        ? `Tối đa ${MAX} ký tự.`
        : null;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (error) {
            setSubmitted(true);
            area.current?.focus();
            return;
          }
          onConfirm(reason.trim());
        }}
      >
        <div className="dialog-head">
          <h2 id={`${id}-title`}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Đóng"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        {description && <p className="muted">{description}</p>}
        {children}
        {withReason && (
          <div className="field">
            <label htmlFor={`${id}-reason`}>
              {label} <span aria-hidden="true">*</span>
            </label>
            <textarea
              id={`${id}-reason`}
              ref={area}
              rows={4}
              value={reason}
              required
              aria-invalid={submitted && !!error}
              aria-describedby={`${id}-help`}
              onChange={(e) => setReason(e.target.value)}
            />
            <div
              id={`${id}-help`}
              className={submitted && error ? "field-error" : "hint"}
            >
              {submitted && error ? error : help}
            </div>
          </div>
        )}
        <div className="dialog-foot">
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className={`btn btn-${tone}`}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
