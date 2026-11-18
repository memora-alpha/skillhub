"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/console/icon";
import { RecordId } from "./admin-ui";
import { StaffUserProfile } from "./user-profile";
import styles from "./user-profile-reference.module.css";

export function UserProfileReference({
  userId,
  label = "người dùng",
  children,
  className = "link",
}: Readonly<{
  userId: string;
  label?: string;
  children?: ReactNode;
  className?: string;
}>) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const valid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId);
  function open(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const shell = event.currentTarget.closest(".staff-shell");
    setHost(shell instanceof HTMLElement ? shell : document.body);
  }
  if (!valid)
    return <span className="mono">{userId || "Chưa có thông tin"}</span>;
  return (
    <>
      {children ? (
        <button
          type="button"
          className={
            className === "link" ? `link ${styles.trigger}` : className
          }
          aria-label={`Xem hồ sơ ${label} ${userId}`}
          aria-haspopup="dialog"
          onClick={open}
        >
          {children}
        </button>
      ) : (
        <RecordId
          id={userId}
          label={label}
          onActivate={open}
          activateLabel={`Xem hồ sơ ${label} ${userId}`}
          activateClassName={styles.trigger}
        />
      )}
      {host &&
        createPortal(
          <UserProfileModal
            key={userId}
            userId={userId}
            onClose={() => setHost(null)}
          />,
          host,
        )}
    </>
  );
}

function UserProfileModal({
  userId,
  onClose,
}: Readonly<{ userId: string; onClose: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    element?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      document.documentElement.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClose={(event) => event.stopPropagation()}
    >
      <header className={styles.header}>
        <div>
          <h2 ref={heading} id={titleId} tabIndex={-1}>
            Hồ sơ người dùng
          </h2>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Đóng hồ sơ người dùng"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className={styles.body}>
        <StaffUserProfile userId={userId} embedded />
      </div>
      <footer className={styles.footer}>
        <RecordId id={userId} label="người dùng" />
        <button type="button" className="btn" onClick={onClose}>
          Đóng hồ sơ
        </button>
      </footer>
    </dialog>
  );
}
