"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNavigationDrawer } from "@/components/use-navigation-drawer";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { eventAffectsResource } from "../api/events";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { ProductIcon } from "./product-icon";
import { NotificationBell } from "./notification-bell";
import { formText } from "./form-data";
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
  ["/learn/reports", "Báo cáo của tôi", "shield"],
] as const;
export function LearnerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { actor, request, refresh, logout } = useUserSession(),
    pathname = usePathname(),
    router = useRouter();
  const cache = useQueryClient();
  const identity = useUserResource<{ profile: { fullName: string } }>("me");
  const fullName = identity.data?.profile.fullName ?? actor.profile.fullName;
  const wallet = useUserResource<{
    availableCredit: string;
    heldCredit: string;
  }>("me/wallet");
  const [error, setError] = useState<string>(),
    [streamAttempt, setStreamAttempt] = useState(0),
    [live, setLive] = useState(true);
  const {
    open,
    show,
    close,
    trigger: menuButton,
    panel: sidebarRef,
  } = useNavigationDrawer("(min-width: 761px)");
  useEffect(() => {
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
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
    const close = () => {
      generation++;
      source?.close();
      source = undefined;
    };
    const open = async () => {
      close();
      if (document.visibilityState === "hidden") return;
      const ticket = generation;
      try {
        // Refresh an expired access cookie before opening the non-replaying stream.
        await request("session");
      } catch {
        if (ticket === generation) setLive(false);
        return;
      }
      if (ticket !== generation) return;
      source = new EventSource("/api/user/events");
      source.onopen = () => {
        setLive(true);
        void cache.invalidateQueries({
          queryKey: ["learner", actor.userId, "notifications/unread-count"],
        });
      };
      for (const type of [
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
      ])
        source.addEventListener(type, changed);
      source.onerror = () => {
        close();
        setLive(false);
      };
    };
    const focus = () => {
      if (document.visibilityState === "visible") {
        refresh();
        void open();
      } else close();
    };
    void open();
    document.addEventListener("visibilitychange", focus);
    return () => {
      close();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [request, refresh, streamAttempt, cache, actor.userId]);

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
        <div className="sidebar-help">
          <ProductIcon name="users" />
          <b>Học tốt hơn khi có nhau.</b>
          <p>Tìm người đồng hành phù hợp với mục tiêu của bạn.</p>
          <Link href="/learn/explore" onClick={() => close(false)}>
            Khám phá ngay →
          </Link>
        </div>
        <Link
          className="sidebar-profile"
          href="/learn/profile"
          onClick={() => close(false)}
        >
          <span>{fullName.slice(0, 1)}</span>
          <div>
            <b>{fullName}</b>
            <small>Xem hồ sơ</small>
          </div>
          <ProductIcon name="chevron" />
        </Link>
        <button
          type="button"
          className="product-logout"
          onClick={() => {
            void logout().catch((cause: unknown) =>
              setError(
                cause instanceof Error ? cause.message : "Không thể đăng xuất.",
              ),
            );
          }}
        >
          Đăng xuất
        </button>
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
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              const term = formText(new FormData(e.currentTarget), "q").trim();
              router.push("/learn/explore?q=" + encodeURIComponent(term));
            }}
          >
            <ProductIcon name="search" />
            <input
              name="q"
              aria-label="Tìm nhu cầu học"
              placeholder="Tìm kỹ năng bạn quan tâm…"
              maxLength={120}
            />
            <button type="submit" aria-label="Tìm kiếm">
              <ProductIcon name="arrow" size={16} />
            </button>
          </form>
          <Link className="header-wallet" href="/learn/wallet">
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
        </header>
        <main id="learning-content" className="app-content" tabIndex={-1}>
          {error && (
            <p className="learner-error" role="alert">
              {error}
            </p>
          )}
          {!live && (
            <p className="learner-notice">
              Cập nhật trực tiếp tạm ngắt.{" "}
              <button
                type="button"
                className="learner-text-button"
                onClick={() => {
                  refresh();
                  setStreamAttempt((v) => v + 1);
                }}
              >
                Kết nối lại
              </button>
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
