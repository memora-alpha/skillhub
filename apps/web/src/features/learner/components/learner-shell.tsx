"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventAffectsResource } from "../api/events";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
const links = [
  ["/learn", "Khám phá"],
  ["/learn/connections", "Kết nối"],
  ["/learn/messages", "Tin nhắn"],
  ["/learn/paths", "Lộ trình"],
  ["/learn/calendar", "Lịch học"],
  ["/learn/skills", "Kỹ năng của tôi"],
];
export function LearnerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { actor, request, refresh, logout } = useUserSession(),
    pathname = usePathname();
  const cache = useQueryClient();
  const wallet = useUserResource<{
    availableCredit: string;
    heldCredit: string;
  }>("me/wallet");
  const [error, setError] = useState<string>(),
    [streamAttempt, setStreamAttempt] = useState(0),
    [live, setLive] = useState(true);
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
            predicate: (query) =>
              query.queryKey[0] === "learner" &&
              query.queryKey[1] === actor.userId &&
              received.some((type) =>
                eventAffectsResource(query.queryKey[2], type),
              ),
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
      source.onopen = () => setLive(true);
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
  return (
    <div className="learner-root">
      <header className="learner-topbar">
        <Link className="learner-brand" href="/learn">
          SkillHub<span>học cùng nhau</span>
        </Link>
        <nav aria-label="Điều hướng học tập">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href!}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="learner-account">
          <span className="learner-avatar" aria-hidden="true">
            {actor.profile.fullName[0] ?? "S"}
          </span>
          <span>{actor.profile.fullName}</span>
          <button
            className="learner-text-button"
            onClick={() => {
              void logout().catch((cause: unknown) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể đăng xuất.",
                ),
              );
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <div className="learner-subbar">
        <span>Không gian học tập của bạn</span>
        <span>
          {wallet.data ? (
            <>
              <strong>{wallet.data.availableCredit} CR</strong> khả dụng ·{" "}
              {wallet.data.heldCredit} CR đang giữ
            </>
          ) : (
            "Ví Credit"
          )}
        </span>
      </div>
      <main className="learner-content">
        {error && (
          <p className="learner-error" role="alert">
            {error}
          </p>
        )}
        {!live && (
          <p className="learner-notice">
            Cập nhật trực tiếp tạm ngắt.{" "}
            <button
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
      <footer className="learner-footer">
        <Link href="/learn">SkillHub</Link>
        <span>Chia sẻ điều bạn biết. Học điều bạn muốn.</span>
      </footer>
    </div>
  );
}
