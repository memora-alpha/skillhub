"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ConsoleProvider, useConsole, type Portal } from "./context";
import { Icon, type IconName } from "./icon";

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const NAV: Record<Portal, NavGroup[]> = {
  admin: [
    {
      title: "Tổng quan",
      items: [
        { href: "/admin", label: "Dashboard", icon: "grid", exact: true },
      ],
    },
    {
      title: "Kiểm duyệt",
      items: [
        {
          href: "/admin/evidence",
          label: "Bằng chứng kỹ năng",
          icon: "shield",
        },
        {
          href: "/admin/moderation",
          label: "Kiểm duyệt nội dung",
          icon: "flag",
        },
        {
          href: "/admin/disputes",
          label: "Báo cáo & tranh chấp",
          icon: "alert",
        },
      ],
    },
    {
      title: "Quản lý",
      items: [
        { href: "/admin/users", label: "Người dùng", icon: "users" },
        { href: "/admin/skills", label: "Danh mục kỹ năng", icon: "tag" },
        { href: "/admin/content", label: "Nội dung", icon: "file" },
      ],
    },
    {
      title: "Tài chính & uy tín",
      items: [
        { href: "/admin/credits", label: "Credit & giao dịch", icon: "card" },
        { href: "/admin/reputation", label: "Đánh giá & uy tín", icon: "star" },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { href: "/admin/config", label: "Cấu hình", icon: "sliders" },
        { href: "/admin/audit", label: "Audit log", icon: "clock" },
      ],
    },
  ],
  staff: [
    {
      title: "Hàng đợi",
      items: [
        { href: "/staff", label: "Tổng quan", icon: "inbox", exact: true },
        {
          href: "/staff/evidence",
          label: "Bằng chứng kỹ năng",
          icon: "shield",
        },
        {
          href: "/staff/moderation",
          label: "Kiểm duyệt nội dung",
          icon: "flag",
        },
        {
          href: "/staff/disputes",
          label: "Báo cáo & tranh chấp",
          icon: "alert",
        },
      ],
    },
  ],
};

const PORTAL_LABEL: Record<Portal, string> = {
  admin: "Admin",
  staff: "Staff",
};

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { portal, actor } = useConsole();
  const other: Portal = portal === "admin" ? "staff" : "admin";

  return (
    <>
      <div className="side-head">
        <span className="logo" aria-hidden="true">
          S
        </span>
        <div>
          <div className="side-title">SkillHub</div>
          <div className="side-sub">Cổng {PORTAL_LABEL[portal]}</div>
        </div>
        <button
          className="icon-btn menu-btn side-close"
          aria-label="Đóng menu"
          onClick={onNavigate}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <nav className="side-nav" aria-label="Điều hướng chính">
        {NAV[portal].map((group) => (
          <div key={group.title} className="nav-group">
            <div className="nav-title">{group.title}</div>
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {actor.name.split(" ").at(-1)?.[0]}
          </span>
          <div>
            <div className="who-name">{actor.name}</div>
            <div className="who-role">{actor.role}</div>
          </div>
        </div>
        {/* ponytail: demo-only portal switch, remove once real auth picks the portal */}
        <Link
          className="nav-link subtle"
          href={`/${other}`}
          onClick={onNavigate}
        >
          <Icon name="users" />
          Xem với vai trò {PORTAL_LABEL[other]}
        </Link>
        <Link className="nav-link subtle" href="/" onClick={onNavigate}>
          <Icon name="logout" />
          Đăng xuất
        </Link>
      </div>
    </>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { portal } = useConsole();
  const close = () => setOpen(false);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Bỏ qua điều hướng
      </a>
      <aside
        id="side"
        className="side"
        data-open={open}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <Sidebar onNavigate={close} />
      </aside>
      {open && (
        <button className="scrim" aria-label="Đóng menu" onClick={close} />
      )}
      <div className="main-col">
        <header className="topbar">
          <button
            className="icon-btn menu-btn"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="side"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="topbar-crumb">
            SkillHub <Icon name="right" size={14} /> Cổng {PORTAL_LABEL[portal]}
          </span>
        </header>
        <main id="main" className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

export function ConsoleShell({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  return (
    <ConsoleProvider portal={portal}>
      <Frame>{children}</Frame>
    </ConsoleProvider>
  );
}
