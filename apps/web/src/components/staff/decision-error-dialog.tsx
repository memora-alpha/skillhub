"use client";
import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/console/icon";

export function DecisionErrorDialog({
  message,
  requiresReload,
  onClose,
  onReload,
}: Readonly<{
  message: string;
  requiresReload: boolean;
  onClose: () => void;
  onReload: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    button.current?.focus();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      className="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      style={{
        width: "min(480px, calc(100vw - 32px))",
        margin: "auto",
        maxHeight: "80dvh",
        position: "fixed",
        inset: 0,
      }}
    >
      <div className="staff-dialog">
        <div className="row">
          <Icon name="alert" size={24} />
          <h2 id={`${id}-title`}>Chưa thể lưu quyết định</h2>
        </div>
        <p id={`${id}-message`} className="prose">
          {message}
        </p>
        {requiresReload && (
          <p className="muted">
            Cần tải lại trạng thái trước khi gửi quyết định tiếp theo.
          </p>
        )}
        <div className="staff-dialog-actions">
          <button
            ref={button}
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Quay lại xem quyết định
          </button>
          {requiresReload && (
            <button type="button" className="btn" onClick={onReload}>
              Tải lại dữ liệu
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
