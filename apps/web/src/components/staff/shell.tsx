"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/console/icon";
import { StaffSessionProvider, useStaffSession } from "./session";
import { StaffLogin } from "./login";
import type { Portal } from "@/lib/staff/policy";
const nav: { href: string; label: string; icon: IconName }[] = [
  { href: "/staff", label: "Tổng quan", icon: "inbox" },
  { href: "/staff/evidence", label: "Bằng chứng kỹ năng", icon: "shield" },
  { href: "/staff/moderation", label: "Yêu cầu học chờ duyệt", icon: "flag" },
  { href: "/staff/disputes", label: "Báo cáo & tranh chấp", icon: "alert" },
  { href: "/staff/notifications", label: "Thông báo", icon: "bell" },
];
const adminNav: typeof nav = [
  { href: "/admin", label: "Tổng quan", icon: "grid" },
  { href: "/admin/users", label: "Người dùng", icon: "users" },
  { href: "/admin/skills", label: "Danh mục kỹ năng", icon: "tag" },
  { href: "/admin/tags", label: "Thẻ", icon: "tag" },
  { href: "/admin/tag-requests", label: "Đề xuất thẻ", icon: "flag" },
  { href: "/admin/evidence", label: "Bằng chứng kỹ năng", icon: "shield" },
  { href: "/admin/moderation", label: "Yêu cầu học chờ duyệt", icon: "flag" },
  { href: "/admin/disputes", label: "Báo cáo & tranh chấp", icon: "alert" },
  { href: "/admin/config", label: "Quy tắc kiểm duyệt", icon: "sliders" },
  { href: "/admin/notifications", label: "Thông báo", icon: "bell" },
];
function Frame({ children }: Readonly<{ children: ReactNode }>) {
  const { actor, loading, logout, busy, portal } = useStaffSession();
  const links = portal === "admin" ? adminNav : nav;
  const portalName = portal === "admin" ? "Admin" : "Staff";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  if (loading)
    return (
      <output className="staff-loading">Đang kiểm tra phiên làm việc…</output>
    );
  if (!actor) return <StaffLogin />;
  const current = links.find((item) =>
    item.href === `/${portal}`
      ? pathname === item.href
      : pathname.startsWith(item.href),
  );
  return (
    <div className="shell staff-shell" key={actor.userId}>
      <a className="skip-link" href="#main">
        Bỏ qua điều hướng
      </a>
      <aside id="staff-side" className="side" data-open={open}>
        <div className="side-head">
          <span className="logo" aria-hidden="true">
            S
          </span>
          <div>
            <div className="side-title">SkillHub</div>
            <div className="side-sub">Cổng {portalName}</div>
          </div>
          <button
            type="button"
            className="icon-btn menu-btn side-close"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          >
            <Icon name="x" />
          </button>
        </div>
        <nav className="side-nav" aria-label={`Điều hướng ${portalName}`}>
          <div className="nav-title">KHÔNG GIAN LÀM VIỆC</div>
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={current?.href === item.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">
            <span className="avatar" aria-hidden="true">
              {actor.fullName.slice(0, 1)}
            </span>
            <div>
              <div className="who-name">{actor.fullName}</div>
              <div className="who-role">{actor.roles.join(" · ")}</div>
            </div>
          </div>
          <button
            type="button"
            className="nav-link subtle"
            disabled={busy}
            onClick={async () => {
              setError(null);
              try {
                await logout();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không thể đăng xuất.",
                );
              }
            }}
          >
            <Icon name="logout" />
            {busy ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      </aside>
      {open && (
        <button
          type="button"
          className="scrim"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="staff-side"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <span className="topbar-crumb">
            SkillHub <Icon name="right" size={14} />{" "}
            {current?.label ?? portalName}
          </span>
          <Link
            className="icon-btn"
            href={`/${portal}/notifications`}
            aria-label="Mở thông báo"
          >
            <Icon name="bell" />
          </Link>
        </header>
        <main id="main" className="content">
          {error && (
            <p className="staff-error" role="alert">
              {error}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
export function StaffShell({
  children,
  portal = "staff",
}: Readonly<{
  children: ReactNode;
  portal?: Portal;
}>) {
  return (
    <StaffSessionProvider portal={portal}>
      <Frame>{children}</Frame>
    </StaffSessionProvider>
  );
}
