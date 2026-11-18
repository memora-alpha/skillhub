"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNavigationDrawer } from "@/components/use-navigation-drawer";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { eventAffectsResource } from "../api/events";
import { createLearnerEventConnection } from "../api/live-events";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
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
const links = [
  ["/learn", "Tổng quan", "home"],
  ["/learn/explore", "Khám phá", "search"],
  ["/learn/connections", "Đề nghị", "users"],
  ["/learn/messages", "Tin nhắn", "chat"],
  ["/learn/paths", "Lộ trình", "book"],
  ["/learn/calendar", "Lịch học", "calendar"],
  ["/learn/materials", "Tài liệu", "file"],
  ["/learn/wallet", "Ví Credit", "wallet"],
  ["/learn/achievements", "Thành tích", "award"],
  ["/learn/reviews", "Đánh giá của tôi", "star"],
  ["/learn/reports", "Báo cáo của tôi", "shield"],
] as const;
export function LearnerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { actor, request, refresh, logout } = useUserSession(),
    pathname = usePathname(),
    router = useRouter();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const identity = useUserResource<{
    profile: { fullName: string; avatarUrl: string | null };
  }>("me");
  const fullName = identity.data?.profile.fullName ?? actor.profile.fullName;
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
  } = useNavigationDrawer("(min-width: 761px)");
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
      // Recover updates missed while the non-replaying connection was down.
      ready: refresh,
      changed,
      eventTypes: [
        "chat.message.created",
        "chat.delivery.updated",
        "chat.read.updated",
        "proposal.created",
        "proposal.updated",
        "proposal.accepted",
        "proposal.rejected",
        "proposal.withdrawn",
        "proposal.expired",
        "wallet.updated",
        "payment.updated",
        "notification.created",
        "resync-required",
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

  const Sidebar = open ? "dialog" : "aside";
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
            <ProductIcon name="close" />
          </button>
        </div>
        <nav aria-label="Điều hướng học tập">
          {links.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => close(false)}
              aria-current={
                pathname === href ||
                (href !== "/learn" && pathname.startsWith(href + "/"))
                  ? "page"
                  : undefined
              }
            >
              <ProductIcon name={icon} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
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
            <ProductIcon name="search" />
            <SearchInput
              name="q"
              aria-label="Tìm nhu cầu học"
              placeholder="Tìm kỹ năng bạn quan tâm…"
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
          <Link
            className="header-wallet"
            href="/learn/wallet"
            aria-label={
              wallet.data
                ? "Ví Credit: " + wallet.data.availableCredit + " CR khả dụng"
                : "Ví Credit"
            }
          >
            <ProductIcon name="wallet" />
            <span>
              <b>
                {wallet.data
                  ? wallet.data.availableCredit + " CR"
                  : "Ví Credit"}
              </b>
              <small>Credit khả dụng</small>
            </span>
          </Link>
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
          {actor.roles.includes("STAFF") && (
            <p>
              <Link className="btn" href="/staff">
                Về khu vực nhân sự
              </Link>
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
