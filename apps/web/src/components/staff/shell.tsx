"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigationDrawer } from "@/components/use-navigation-drawer";
import { Icon, type IconName } from "@/components/console/icon";
import { StaffSessionProvider, useStaffSession } from "./session";
import { StaffLogin } from "./login";
import { StaffShellSkeleton } from "./shell-skeleton";
import {
  adminSectionGroups,
  adminSections,
  findAdminSection,
} from "@/lib/staff/admin-navigation";
import {
  findStaffNavItem,
  staffNavGroups,
  visibleStaffNavItems,
} from "@/lib/staff/staff-navigation";
import {
  countGrantedDelegablePermissions,
  isAdminActor,
  STAFF_DELEGABLE_PERMISSIONS,
} from "@/lib/staff/permissions";
import { AdminSectionNavigation } from "./admin-section-navigation";
import {
  NotificationsProvider,
  useNotificationInbox,
} from "./notification-session";
import type { Portal } from "@/lib/staff/policy";

type NavigationItem = Readonly<{
  href: string;
  label: string;
  icon: IconName;
}>;

function NavigationLinks({
  items,
  currentHref,
  onNavigate,
}: Readonly<{
  items: readonly NavigationItem[];
  currentHref: string | undefined;
  onNavigate: () => void;
}>) {
  return items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className="nav-link"
      aria-current={currentHref === item.href ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
    </Link>
  ));
}

function roleDisplayLabel(roles: readonly string[]) {
  if (roles.includes("ADMIN")) return "Quản trị viên";
  if (roles.includes("STAFF")) return "Nhân viên vận hành";
  return roles.join(" · ");
}

function Frame({ children }: Readonly<{ children: ReactNode }>) {
  const { actor, loading, logout, logoutAll, busy, portal } = useStaffSession();
  const portalName = portal === "admin" ? "Admin" : "Staff";
  const workspaceName =
    portal === "admin" ? "Quản trị hệ thống" : "Nhân viên vận hành";
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
    const navEl = sidebarRef.current?.querySelector<HTMLElement>(".side-nav");
    const currentEl = navEl?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (!navEl || !currentEl || !navEl.clientHeight) return;
    const viewportTop = navEl.getBoundingClientRect().top + navEl.clientTop;
    const bounds = currentEl.getBoundingClientRect();
    if (bounds.top < viewportTop) navEl.scrollTop += bounds.top - viewportTop;
    else if (bounds.bottom > viewportTop + navEl.clientHeight)
      navEl.scrollTop += bounds.bottom - viewportTop - navEl.clientHeight;
  }, [pathname, actor?.userId, sidebarRef]);

  if (loading) return <StaffShellSkeleton portal={portal} />;
  if (!actor) return <StaffLogin />;

  const adminSection =
    portal === "admin" ? findAdminSection(pathname) : undefined;
  const staffNav = visibleStaffNavItems(actor);
  const staffCurrent =
    portal === "staff" ? findStaffNavItem(pathname) : undefined;

  const currentHref =
    portal === "admin" ? adminSection?.href : staffCurrent?.href;
  const currentGroup =
    portal === "admin" ? adminSection?.group : staffCurrent?.group;
  const currentLabel =
    portal === "admin"
      ? (adminSection?.label ??
        (pathname === "/admin/notifications" ? "Thông báo" : portalName))
      : (staffCurrent?.label ??
        (pathname === "/staff/wallet"
          ? "Ví cá nhân"
          : pathname === "/staff/reputation"
            ? "Uy tín cá nhân"
            : portalName));

  const grantedCount = countGrantedDelegablePermissions(actor);
  const totalDelegable = STAFF_DELEGABLE_PERMISSIONS.length;
  const Sidebar = open ? "dialog" : "aside";

  return (
    <div
      className="shell staff-shell"
      data-portal={portal}
      data-admin-redesign="true"
      key={actor.userId}
    >
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
            <div className="side-title">
              Skill<em>Hub</em>
            </div>
            <div className="side-sub">
              {portal === "admin" ? "Cổng quản trị" : "Khu vực vận hành"}
            </div>
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
            <Icon name={portal === "admin" ? "shield" : "inbox"} size={17} />
          </span>
          <div>
            <small>
              {portal === "admin" ? "Admin Portal" : "Staff Console"}
            </small>
            <strong>{workspaceName}</strong>
            <span className="ops-workspace-meta">
              {portal === "admin"
                ? "Quản trị & kiểm soát hệ thống"
                : isAdminActor(actor)
                  ? "Toàn quyền vận hành (Admin)"
                  : `${grantedCount}/${totalDelegable} quyền vận hành`}
            </span>
          </div>
        </div>

        <nav className="side-nav" aria-label={`Điều hướng ${portalName}`}>
          {portal === "admin"
            ? adminSectionGroups.map((group) => {
                const items = adminSections.filter((s) => s.group === group);
                return items.length ? (
                  <div className="nav-group" key={group}>
                    <div className="nav-group-heading">{group}</div>
                    <NavigationLinks
                      items={items}
                      currentHref={currentHref}
                      onNavigate={() => close(false)}
                    />
                  </div>
                ) : null;
              })
            : staffNavGroups.map((group) => {
                const items = staffNav.filter((item) => item.group === group);
                return items.length ? (
                  <div className="nav-group" key={group}>
                    <div className="nav-group-heading">{group}</div>
                    <NavigationLinks
                      items={items}
                      currentHref={currentHref}
                      onNavigate={() => close(false)}
                    />
                  </div>
                ) : null;
              })}
        </nav>

        <div className="side-foot">
          <div className="who">
            <span className="avatar" aria-hidden="true">
              {actor.fullName.trim().slice(0, 1).toUpperCase()}
            </span>
            <div>
              <div className="who-name">{actor.fullName}</div>
              <div className="who-role">{roleDisplayLabel(actor.roles)}</div>
            </div>
          </div>
          <LoadingButton
            type="button"
            className="nav-link subtle"
            disabled={busy}
            loading={busy}
            onClick={() => {
              void logoutAll().catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Chưa thể đăng xuất mọi thiết bị.",
                ),
              );
            }}
          >
            Đăng xuất mọi thiết bị
          </LoadingButton>
          <LoadingButton
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
            loading={!!busy}
          >
            <Icon name="logout" size={17} />
            {busy ? "Đang đăng xuất…" : "Đăng xuất"}
          </LoadingButton>
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
          <div className="topbar-left">
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
              <span className="ops-crumb-root">SkillHub</span>
              {currentGroup && (
                <>
                  <Icon name="right" size={13} />
                  <span>{currentGroup}</span>
                </>
              )}
              <Icon name="right" size={13} />
              <strong>{currentLabel}</strong>
            </span>
          </div>
          <div className="row">
            <span className="ops-portal-chip">
              <Icon name={portal === "admin" ? "shield" : "check"} size={13} />
              {portal === "admin" ? "Quản trị" : "Vận hành"}
            </span>
            {portal === "staff" && actor.roles.includes("STAFF") && (
              <Link href="/learn" className="btn btn-sm">
                <Icon name="book" size={15} />
                <span className="ops-learn-label">Không gian học</span>
                <span className="ops-learn-short">Học tập</span>
              </Link>
            )}
            {portal === "staff" && isAdminActor(actor) && (
              <Link href="/admin" className="btn btn-sm">
                <Icon name="shield" size={15} />
                <span>Cổng Admin</span>
              </Link>
            )}
            <NotificationBell portal={portal} />
            <span
              className="avatar ops-topbar-avatar"
              title={actor.fullName}
              aria-label={actor.fullName}
            >
              {actor.fullName.trim().slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {portal === "admin" && (
            <AdminSectionNavigation section={adminSection} />
          )}
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
