"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigationDrawer } from "@/components/use-navigation-drawer";
import { Icon, type IconName } from "@/components/console/icon";
import { StaffSessionProvider, useStaffSession } from "./session";
import { StaffLogin } from "./login";
import {
  NotificationsProvider,
  useNotificationInbox,
} from "./notification-session";
import type { Portal } from "@/lib/staff/policy";
type NavigationItem = {
  href: string;
  label: string;
  icon: IconName;
  aliases?: string[];
  group?:
    | "Quản trị"
    | "Cá nhân"
    | "Điều hành"
    | "Chất lượng"
    | "Kiểm duyệt"
    | "Hệ thống";
};
const nav: NavigationItem[] = [
  { href: "/staff", label: "Tổng quan", icon: "inbox" },
  { href: "/staff/evidence", label: "Bằng chứng kỹ năng", icon: "shield" },
  { href: "/staff/moderation", label: "Kiểm duyệt yêu cầu học", icon: "flag" },
  {
    href: "/staff/profile-moderation",
    label: "Hồ sơ & đánh giá",
    icon: "users",
  },
  { href: "/staff/restriction-reviews", label: "Xét lại uy tín", icon: "star" },
  { href: "/staff/content", label: "Duyệt tài liệu", icon: "file" },
  { href: "/staff/disputes", label: "Báo cáo & tranh chấp", icon: "alert" },
  { href: "/staff/learning-changes", label: "Dừng lộ trình", icon: "file" },
  { href: "/staff/notifications", label: "Thông báo", icon: "bell" },
  {
    href: "/staff/wallet",
    label: "Ví của tôi",
    icon: "card",
    group: "Cá nhân",
  },
  {
    href: "/staff/reputation",
    label: "Uy tín của tôi",
    icon: "star",
    group: "Cá nhân",
  },
];
type NavigationEntry = readonly [
  href: string,
  label: string,
  icon: IconName,
  group: NonNullable<NavigationItem["group"]>,
  aliases?: string[],
];
const adminEntries: NavigationEntry[] = [
  ["/admin", "Tổng quan", "grid", "Điều hành"],
  ["/admin/users", "Người dùng", "users", "Điều hành"],
  ["/admin/staff-permissions", "Quyền nhân viên", "shield", "Điều hành"],
  ["/admin/profile-moderation", "Hồ sơ & đánh giá", "users", "Chất lượng"],
  ["/admin/reputation", "Xét lại uy tín", "star", "Chất lượng"],
  ["/admin/credits", "Tài chính", "card", "Hệ thống"],
  ["/admin/skills", "Danh mục kỹ năng", "tag", "Chất lượng"],
  [
    "/admin/tags",
    "Tag cộng đồng",
    "tag",
    "Chất lượng",
    ["/admin/tag-requests"],
  ],
  ["/admin/evidence", "Bằng chứng kỹ năng", "shield", "Chất lượng"],
  ["/admin/moderation", "Kiểm duyệt yêu cầu học", "flag", "Kiểm duyệt"],
  ["/admin/content", "Duyệt tài liệu", "file", "Kiểm duyệt"],
  ["/admin/disputes", "Báo cáo & tranh chấp", "alert", "Kiểm duyệt"],
  ["/admin/learning-changes", "Dừng lộ trình", "file", "Kiểm duyệt"],
  ["/admin/config", "Quy tắc kiểm duyệt", "sliders", "Kiểm duyệt"],
  ["/admin/notifications", "Thông báo", "bell", "Hệ thống"],
];
const adminNav: NavigationItem[] = adminEntries.map(
  ([href, label, icon, group, aliases]) => ({
    href,
    label,
    icon,
    group,
    aliases,
  }),
);
function Frame({ children }: Readonly<{ children: ReactNode }>) {
  const { actor, loading, logout, busy, portal } = useStaffSession();
  const links = portal === "admin" ? adminNav : nav;
  const portalName = portal === "admin" ? "Admin" : "Staff";
  const workspaceName =
    portal === "admin" ? "Quản trị viên" : "Nhân viên vận hành";
  const pathname = usePathname();
  const {
    open,
    show,
    close,
    trigger: menuButton,
    panel: sidebarRef,
  } = useNavigationDrawer("(min-width: 1024px)");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    sidebarRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname, actor?.userId, sidebarRef]);
  if (loading)
    return (
      <output className="staff-loading">Đang kiểm tra phiên làm việc…</output>
    );
  if (!actor) return <StaffLogin />;
  const current = links.find((item) =>
    item.href === `/${portal}`
      ? pathname === item.href
      : pathname.startsWith(item.href) || item.aliases?.includes(pathname),
  );
  const Sidebar = open ? "dialog" : "aside";
  return (
    <div className="shell staff-shell" key={actor.userId}>
      <a className="skip-link" href="#main" inert={open}>
        Bỏ qua điều hướng
      </a>
      <Sidebar
        open={open || undefined}
        style={
          open
            ? { margin: 0, maxWidth: "none", maxHeight: "none", border: 0 }
            : undefined
        }
        ref={(element: HTMLElement | null) => {
          sidebarRef.current = element;
        }}
        id="staff-side"
        className="side"
        data-open={open}
        aria-modal={open || undefined}
        aria-label={`Điều hướng ${portalName}`}
      >
        <div className="side-head">
          <span className="logo" aria-hidden="true">
            S
          </span>
          <div>
            <div className="side-title">SkillHub</div>
            <div className="side-sub">Không gian vận hành</div>
          </div>
          <button
            type="button"
            className="icon-btn menu-btn side-close"
            aria-label="Đóng menu"
            onClick={() => close()}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="ops-workspace-identity">
          <span className="avatar" aria-hidden="true">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <small>Không gian làm việc</small>
            <strong>{workspaceName}</strong>
          </div>
        </div>
        <nav className="side-nav" aria-label={`Điều hướng ${portalName}`}>
          {(portal === "admin"
            ? ["Điều hành", "Chất lượng", "Kiểm duyệt", "Hệ thống"]
            : ["Công việc", "Quản trị", "Cá nhân"]
          ).map((group) => {
            const items = links.filter(
              (item) => (item.group ?? "Công việc") === group,
            );
            return items.length ? (
              <div className="nav-group" key={group}>
                <div className="nav-title">{group}</div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-link"
                    aria-current={
                      current?.href === item.href ? "page" : undefined
                    }
                    onClick={() => close(false)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ) : null;
          })}
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
      </Sidebar>
      {open && (
        <button
          type="button"
          className="scrim"
          aria-label="Đóng menu"
          onClick={() => close()}
          tabIndex={-1}
        />
      )}
      <div className="main-col" inert={open}>
        <header className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="icon-btn menu-btn"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="staff-side"
            onClick={show}
          >
            <Icon name="menu" />
          </button>
          <span className="topbar-crumb">
            <span className="ops-crumb-root">SkillHub</span>{" "}
            <Icon name="right" size={14} />{" "}
            <strong>{current?.label ?? portalName}</strong>
          </span>
          <div className="row">
            {actor.roles.includes("STAFF") && (
              <Link href="/learn" className="btn">
                <span className="ops-learn-label">Không gian học</span>
                <span className="ops-learn-short">Học tập</span>
              </Link>
            )}
            <NotificationBell portal={portal} />
            <span
              className="avatar ops-topbar-avatar"
              title={actor.fullName}
              aria-label={actor.fullName}
            >
              {actor.fullName.slice(0, 1)}
            </span>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
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
      <NotificationsProvider>
        <Frame>{children}</Frame>
      </NotificationsProvider>
    </StaffSessionProvider>
  );
}
function NotificationBell({ portal }: Readonly<{ portal: Portal }>) {
  const { unreadCount } = useNotificationInbox();
  const unread = unreadCount ?? 0;
  const unreadDescription = unread > 99 ? "hơn 99" : unread;
  return (
    <Link
      className="icon-btn staff-notification-bell"
      href={`/${portal}/notifications`}
      aria-label={
        unread
          ? `Thông báo — ${unreadDescription} thông báo chưa đọc`
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
