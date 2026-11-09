"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ProductIcon } from "./product-icon";
import styles from "./learning-layout.module.css";

export function CaseDrawer({
  title,
  onClose,
  children,
}: Readonly<{
  title: string;
  onClose: () => void;
  children: ReactNode;
}>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.drawerSurface}>
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Hỗ trợ riêng</p>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            aria-label="Đóng vụ việc"
          >
            <ProductIcon name="close" size={18} />
          </button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </dialog>
  );
}
