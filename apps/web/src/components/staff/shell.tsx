"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/console/icon";
import { StaffSessionProvider, useStaffSession } from "./session";
import { StaffLogin } from "./login";
import {
  NotificationsProvider,
  useNotificationInbox,
} from "./notification-session";
import type { Portal } from "@/lib/staff/policy";
import { resetDemoData } from "@/lib/staff/demo-api";
const nav: { href: string; label: string; icon: IconName }[] = [
  { href: "/staff", label: "Tổng quan", icon: "inbox" },
  { href: "/staff/evidence", label: "Bằng chứng kỹ năng", icon: "shield" },
  { href: "/staff/moderation", label: "Yêu cầu học chờ duyệt", icon: "flag" },
  { href: "/staff/content", label: "Duyệt tài liệu", icon: "file" },
  { href: "/staff/disputes", label: "Báo cáo & tranh chấp", icon: "alert" },
  { href: "/staff/notifications", label: "Thông báo", icon: "bell" },
  { href: "/staff/wallet", label: "Ví của tôi", icon: "card" },
  { href: "/staff/reputation", label: "Uy tín của tôi", icon: "star" },
];
const adminNav: typeof nav = [
  { href: "/admin", label: "Tổng quan", icon: "grid" },
  { href: "/admin/users", label: "Người dùng", icon: "users" },
  { href: "/admin/skills", label: "Danh mục kỹ năng", icon: "tag" },
  { href: "/admin/tags", label: "Danh mục tag", icon: "tag" },
  { href: "/admin/tag-requests", label: "Đề xuất tag", icon: "inbox" },
  { href: "/admin/evidence", label: "Bằng chứng kỹ năng", icon: "shield" },
  { href: "/admin/moderation", label: "Yêu cầu học chờ duyệt", icon: "flag" },
  { href: "/admin/content", label: "Duyệt tài liệu", icon: "file" },
  { href: "/admin/disputes", label: "Báo cáo & tranh chấp", icon: "alert" },
  { href: "/admin/config", label: "Quy tắc kiểm duyệt", icon: "sliders" },
  { href: "/admin/achievements", label: "Thành tích của tôi", icon: "star" },
  { href: "/admin/wallet", label: "Ví của tôi", icon: "card" },
  { href: "/admin/my-reputation", label: "Uy tín của tôi", icon: "star" },
  { href: "/admin/notifications", label: "Thông báo", icon: "bell" },
];
function Frame({ children }: Readonly<{ children: ReactNode }>) {
  const { actor, loading, logout, busy, portal, demo, setDemo } =
    useStaffSession();
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
          <div className="row">
            {portal === "admin" && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => setDemo(!demo)}
              >
                {demo ? "Dùng dữ liệu thật" : "Dùng dữ liệu thử"}
              </button>
            )}
            <NotificationBell portal={portal} />
          </div>
        </header>
        <main id="main" className="content">
          {demo && (
            <aside
              className="staff-demo-notice"
              aria-label="Chế độ dữ liệu thử"
            >
              <div>
                <strong>Đang dùng dữ liệu thử</strong>
                <p>
                  Mỗi nhóm có ít nhất 5 mẫu. Thao tác chỉ lưu trên trình duyệt
                  này, không thay đổi dữ liệu thật. Không cần nhập mật khẩu thật
                  khi thử cấp quyền.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  try {
                    resetDemoData(actor.userId, window.localStorage);
                    setDemo(false);
                  } catch {
                    setError(
                      "Không thể đặt lại dữ liệu thử. Kiểm tra quyền lưu dữ liệu của trình duyệt.",
                    );
                  }
                }}
              >
                Đặt lại dữ liệu thử
              </button>
            </aside>
          )}
          {error && (
            <p className="staff-error" role="alert">
              {error}
            </p>
          )}
          <div key={demo ? "demo" : "live"}>{children}</div>
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
      <NotificationsProvider>
        <Frame>{children}</Frame>
      </NotificationsProvider>
    </StaffSessionProvider>
  );
}
function NotificationBell({ portal }: Readonly<{ portal: Portal }>) {
  const { unreadCount } = useNotificationInbox();
  const unread = unreadCount ?? 0;
  return (
    <Link
      className="icon-btn staff-notification-bell"
      href={`/${portal}/notifications`}
      aria-label={
        unread
          ? `Thông báo — ${unread > 99 ? "hơn 99" : unread} thông báo chưa đọc`
          : "Mở thông báo"
      }
    >
      <Icon name="bell" />
      {unread > 0 && (
        <span className="staff-notification-count" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
