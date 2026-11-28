"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useNavigationDrawer } from "@/components/use-navigation-drawer";
import {
  useCollapsibleNavGroups,
  type CollapsibleNavGroupConfig,
} from "@/components/use-collapsible-nav-groups";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { eventAffectsResource } from "../api/events";
import { createLearnerEventConnection } from "../api/live-events";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import type { OwnIdentity } from "../account/account-types";
import { ProductIcon } from "./product-icon";
import { NotificationBell } from "./notification-bell";
import { LearnerAccountMenu } from "./learner-account-menu";
import { SearchInput } from "@/components/search-input";

function queryAffected(
  query: Query,
  userId: string,
  events: readonly string[],
) {
  return (
    query.queryKey[0] === "learner" &&
    query.queryKey[1] === userId &&
    events.some((type) => eventAffectsResource(query.queryKey[2], type))
  );
}

function isActiveNavLink(pathname: string, href: string) {
  return (
    pathname === href || (href !== "/learn" && pathname.startsWith(href + "/"))
  );
}

const pinnedHome = ["/learn", "Tổng quan", "home"] as const;

const navSections = [
  {
    id: "discover",
    title: "Kết nối & Trao đổi",
    defaultOpen: true,
    items: [
      ["/learn/explore", "Khám phá", "search"],
      ["/learn/connections", "Đề nghị học tập", "users"],
      ["/learn/messages", "Tin nhắn", "chat"],
    ],
  },
  {
    id: "learning",
    title: "Học & Dạy 1:1",
    defaultOpen: true,
    items: [
      ["/learn/paths", "Lộ trình học", "book"],
      ["/learn/calendar", "Lịch học", "calendar"],
      ["/learn/materials", "Kho tài liệu", "file"],
      ["/learn/skills", "Kỹ năng của tôi", "check"],
    ],
  },
  {
    id: "billing-support",
    title: "Ví & Hỗ trợ",
    defaultOpen: false,
    items: [
      ["/learn/wallet", "Ví Credit", "wallet"],
      ["/learn/subscription", "Gói thành viên", "star"],
      ["/learn/vouchers", "Voucher & phần thưởng", "award"],
      ["/learn/reports", "Báo cáo & hỗ trợ", "filter"],
    ],
  },
] as const;

const learnerNavGroupConfigs: readonly CollapsibleNavGroupConfig[] =
  navSections.map((section) => ({
    id: section.id,
    defaultOpen: section.defaultOpen,
  }));

export function LearnerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { actor, request, refresh, logout } = useUserSession(),
    pathname = usePathname(),
    router = useRouter();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const identity = useUserResource<OwnIdentity>("me", {
    refetchInterval: (data) => (data?.profile.avatarUrl ? 45000 : false),
  });
  const fullName = identity.data?.profile.fullName ?? actor.profile.fullName;
  const reputationScore = identity.data?.profile.reputationScore;
  const wallet = useUserResource<{
    availableCredit: string;
    heldCredit: string;
  }>("me/wallet");
  const {
    open,
    show,
    close,
    trigger: menuButton,
    panel: sidebarRef,
  } = useNavigationDrawer("(min-width: 861px)");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const events = new Set<string>();
    const changed = (event: Event) => {
      events.add(event.type);
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          const received = [...events];
          events.clear();
          void cache.invalidateQueries({
            predicate: (query) => queryAffected(query, actor.userId, received),
          });
        }, 250);
    };
    const connection = createLearnerEventConnection({
      prepare: () => request("session"),
      // Refresh snapshots as well as replaying events missed while disconnected.
      ready: refresh,
      changed,
      eventTypes: [
        "chat.message.created",
        "chat.delivery.updated",
        "chat.read.updated",
        "chat.attachment.updated",
        "chat.attachment.availability.updated",
        "proposal.created",
        "proposal.updated",
        "proposal.accepted",
        "proposal.rejected",
        "proposal.withdrawn",
        "proposal.expired",
        "wallet.updated",
        "payment.updated",
        "notification.created",
        "notification.read",
        "stream.reset-required",
      ],
    });
    const focus = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        refresh();
        connection.resume();
      } else connection.pause();
    };
    focus();
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("online", focus);
    window.addEventListener("offline", focus);
    return () => {
      connection.dispose();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("online", focus);
      window.removeEventListener("offline", focus);
    };
  }, [request, refresh, cache, actor.userId]);

  const navIdPrefix = useId();
  const activeSectionId = navSections.find((section) =>
    section.items.some(([href]) => isActiveNavLink(pathname, href)),
  )?.id;
  const { isExpanded, toggle } = useCollapsibleNavGroups({
    storageKey: "skillhub:sidebar:learner",
    groups: learnerNavGroupConfigs,
    activeGroupId: activeSectionId,
    pathname,
  });

  const Sidebar = open ? "dialog" : "aside";
  const hasHeld = wallet.data && Number(wallet.data.heldCredit) > 0;
  const [homeHref, homeLabel, homeIcon] = pinnedHome;
  return (
    <div className="learner-root workspace">
      <a className="product-skip" href="#learning-content" inert={open}>
        Đến nội dung chính
      </a>
      {open && (
        <button
          type="button"
          className="product-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => close()}
          tabIndex={-1}
        />
      )}
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
        id="learning-sidebar"
        className={"app-sidebar" + (open ? " open" : "")}
        aria-modal={open || undefined}
        aria-label="Điều hướng học tập"
      >
        <div className="sidebar-head">
          <Link
            href="/learn"
            className="app-brand"
            onClick={() => close(false)}
          >
            <span>S</span>
            <b>
              Skill<i>Hub</i>
            </b>
          </Link>
          <button
            type="button"
            aria-label="Đóng điều hướng"
            onClick={() => close()}
          >
            <ProductIcon name="close" size={18} />
          </button>
        </div>
        <nav aria-label="Điều hướng học tập">
          <div className="nav-pinned">
            <Link
              href={homeHref}
              onClick={() => close(false)}
              aria-current={
                isActiveNavLink(pathname, homeHref) ? "page" : undefined
              }
            >
              <ProductIcon name={homeIcon} size={18} />
              <span>{homeLabel}</span>
            </Link>
          </div>
          {navSections.map((section) => {
            const expanded = isExpanded(section.id);
            const hasActive = activeSectionId === section.id;
            const panelId = `${navIdPrefix}-${section.id}`;
            return (
              <div
                className="nav-section"
                key={section.id}
                data-expanded={expanded}
                data-has-active={hasActive || undefined}
              >
                <button
                  type="button"
                  className="nav-section-toggle"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(section.id)}
                >
                  <span className="nav-section-label">
                    {section.title}
                    {!expanded && hasActive && (
                      <span className="nav-section-dot" aria-hidden="true" />
                    )}
                  </span>
                  <span className="nav-section-meta" aria-hidden="true">
                    {!expanded && (
                      <span className="nav-section-count">
                        {section.items.length}
                      </span>
                    )}
                    <span className="nav-section-chevron">
                      <ProductIcon name="chevron" size={14} />
                    </span>
                  </span>
                </button>
                <div
                  id={panelId}
                  className="nav-section-panel"
                  data-open={expanded}
                  inert={!expanded}
                >
                  <div className="nav-section-items">
                    {section.items.map(([href, label, icon]) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => close(false)}
                        aria-current={
                          isActiveNavLink(pathname, href) ? "page" : undefined
                        }
                      >
                        <ProductIcon name={icon} size={18} />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        {actor.roles.includes("STAFF") && (
          <div className="sidebar-footer">
            <Link className="btn" href="/staff" onClick={() => close(false)}>
              <ProductIcon name="shield" size={16} />
              Về khu vực nhân sự
            </Link>
          </div>
        )}
      </Sidebar>
      <div className="workspace-main" inert={open}>
        <header className="app-header">
          <button
            type="button"
            ref={menuButton}
            className="mobile-menu"
            aria-label="Mở điều hướng"
            aria-expanded={open}
            aria-controls="learning-sidebar"
            onClick={show}
          >
            <ProductIcon name="menu" />
          </button>
          <div className="global-search">
            <ProductIcon name="search" size={18} />
            <SearchInput
              name="q"
              aria-label="Tìm nhu cầu học"
              placeholder="Tìm nhu cầu học, kỹ năng bạn quan tâm…"
              maxLength={120}
              value={search}
              onChange={setSearch}
              onSearch={(term) => {
                // Ignore typing superseded by navigation to a different page.
                if (
                  window.location.pathname !== pathname &&
                  window.location.pathname !== "/learn/explore"
                )
                  return;
                const href = "/learn/explore?q=" + encodeURIComponent(term);
                if (window.location.pathname === "/learn/explore")
                  router.replace(href, { scroll: false });
                else router.push(href, { scroll: false });
              }}
            />
          </div>
          <div className="header-metrics">
            {typeof reputationScore === "number" && (
              <Link
                className="header-reputation"
                href="/learn/reputation"
                data-low={reputationScore < 40}
                aria-current={
                  isActiveNavLink(pathname, "/learn/reputation")
                    ? "page"
                    : undefined
                }
                aria-label={`Điểm uy tín: ${reputationScore} trên 100`}
              >
                <ProductIcon name="shield" size={18} />
                <span>
                  <b>{reputationScore}/100</b>
                  <small>
                    {reputationScore < 40 ? "Cần chú ý" : "Điểm uy tín"}
                  </small>
                </span>
              </Link>
            )}
            <Link
              className="header-wallet"
              href="/learn/wallet"
              aria-current={
                isActiveNavLink(pathname, "/learn/wallet") ? "page" : undefined
              }
              aria-label={
                wallet.data
                  ? "Ví Credit: " + wallet.data.availableCredit + " CR khả dụng"
                  : "Ví Credit"
              }
            >
              <ProductIcon name="wallet" size={18} />
              <span>
                <b>
                  {wallet.data
                    ? wallet.data.availableCredit + " CR"
                    : "Ví Credit"}
                </b>
                <small>
                  {hasHeld && wallet.data
                    ? `Đang giữ ${wallet.data.heldCredit} CR`
                    : "Credit khả dụng"}
                </small>
              </span>
            </Link>
          </div>
          <NotificationBell />
          <LearnerAccountMenu
            key={pathname}
            fullName={fullName}
            email={actor.email}
            avatarUrl={
              identity.data
                ? identity.data.profile.avatarUrl
                : actor.profile.avatarUrl
            }
            logout={logout}
          />
        </header>
        <main id="learning-content" className="app-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
