"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ProductIcon } from "./product-icon";
import styles from "./learner-account-menu.module.css";

const accountLinks = [
  ["/learn/tag-requests", "Đề xuất tag của tôi", "book"],
  ["/learn/profile", "Hồ sơ & cài đặt tài khoản", "user"],
  ["/learn/skills", "Quản lý kỹ năng", "book"],
  ["/learn/achievements", "Thành tích & danh hiệu", "award"],
  ["/learn/materials/mine", "Tài liệu của tôi", "file"],
  ["/learn/wallet", "Ví & giao dịch", "wallet"],
  ["/learn/reports", "Báo cáo của tôi", "shield"],
] as const;

function avatarSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function LearnerAccountMenu({
  fullName,
  email,
  avatarUrl,
  logout,
}: Readonly<{
  fullName: string;
  email: string;
  avatarUrl: string | null;
  logout: () => Promise<void>;
}>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const logoutPending = useRef(false);
  const panelId = useId();
  const source = avatarSource(avatarUrl);
  const initial =
    Array.from(fullName.trim())[0]?.toLocaleUpperCase("vi") ?? "S";

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function signOut() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await logout();
    } catch (cause) {
      setOpen(true);
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể đăng xuất. Hãy thử lại.",
      );
    } finally {
      logoutPending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={styles.account} ref={root}>
      <Link
        className={styles.profile}
        href="/learn/profile"
        aria-label={"Xem hồ sơ cá nhân của " + fullName}
        title={fullName}
        onClick={() => setOpen(false)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {source && source !== failedAvatar ? (
            <Image
              src={source}
              alt=""
              width={36}
              height={36}
              unoptimized
              onError={() => setFailedAvatar(source)}
            />
          ) : (
            initial
          )}
        </span>
        <span className={styles.name}>{fullName}</span>
      </Link>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={open ? "Đóng quản lý tài khoản" : "Mở quản lý tài khoản"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ProductIcon name="chevron" size={16} />
      </button>
      {open && (
        <div id={panelId} className={styles.dropdown}>
          <div className={styles.identity}>
            <strong>{fullName}</strong>
            <span>{email}</span>
          </div>
          <nav aria-label="Quản lý tài khoản">
            {accountLinks.map(([href, label, icon]) => (
              <Link
                key={href}
                href={href}
                className={styles.item}
                onClick={() => setOpen(false)}
              >
                <ProductIcon name={icon} size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className={styles.footer}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className={styles.signOut}
              disabled={busy}
              onClick={() => {
                void signOut();
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h12" />
              </svg>
              {busy ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
