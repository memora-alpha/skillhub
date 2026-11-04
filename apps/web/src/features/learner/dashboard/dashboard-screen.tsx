"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { LearningSession, PathSummary, Proposal } from "../types";
import {
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { ProfileName } from "../components/profile-name";
export function DashboardScreen() {
  const { actor } = useUserSession();
  const [now] = useState(() => new Date());
  const range = new URLSearchParams({
    from: now.toISOString(),
    to: new Date(now.getTime() + 30 * 86400000).toISOString(),
  });
  const sessions = useUserResource<LearningSession[]>("sessions/mine?" + range),
    paths = useUserList<PathSummary>("learning-paths/mine?limit=6"),
    proposals = useUserList<Proposal>(
      "proposals?direction=received&status=PENDING&limit=5",
    ),
    wallet = useUserResource<{ availableCredit: string; heldCredit: string }>(
      "me/wallet",
    );
  const upcoming = sessions.data
      ?.filter((s) => !["CANCELLED", "COMPLETED", "CLOSED"].includes(s.status))
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    next = upcoming?.[0];
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "full",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(now)}
        title={"Xin chào, " + actor.profile.fullName + "."}
        description="Tiếp tục hành trình học tập và chia sẻ kỹ năng của bạn."
        action={
          <Link className="btn btn-primary" href="/learn/posts/new">
            <ProductIcon name="plus" size={17} />
            Đăng nhu cầu học
          </Link>
        }
      />
      <section className="stat-grid" aria-label="Tổng quan học tập">
        <article>
          <span className="stat-icon sage">
            <ProductIcon name="calendar" />
          </span>
          <div>
            <small>Buổi học gần nhất</small>
            <strong>
              {next
                ? new Intl.DateTimeFormat("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(next.startAt))
                : sessions.loading
                  ? "Đang tải…"
                  : sessions.error
                    ? "Chưa tải được"
                    : "Chưa có lịch"}
            </strong>
            <b>Trong 30 ngày tới</b>
          </div>
        </article>
        <article>
          <span className="stat-icon orange">
            <ProductIcon name="book" />
          </span>
          <div>
            <small>Lộ trình của bạn</small>
            <strong>
              {paths.loading && !paths.items.length
                ? "Đang tải…"
                : paths.error
                  ? "Chưa tải được"
                  : paths.items.length +
                    (paths.cursor ? "+" : "") +
                    " lộ trình"}
            </strong>
            <b>Các lộ trình mới nhất</b>
          </div>
        </article>
        <article>
          <span className="stat-icon cream">
            <ProductIcon name="wallet" />
          </span>
          <div>
            <small>Ví Credit</small>
            <strong>
              {wallet.data
                ? wallet.data.availableCredit + " khả dụng"
                : wallet.loading
                  ? "Đang tải…"
                  : "Chưa tải được"}
            </strong>
            <b>
              {wallet.data
                ? wallet.data.heldCredit + " Credit đang giữ"
                : "Số dư từ ví của bạn"}
            </b>
          </div>
        </article>
      </section>
      <Feedback error={wallet.error} reload={wallet.reload} />
      <div className="dashboard-columns">
        <Panel>
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Lịch của bạn</span>
              <h2>Buổi học sắp tới</h2>
            </div>
            <Link href="/learn/calendar">Xem lịch →</Link>
          </div>
          <Feedback
            loading={sessions.loading}
            error={sessions.error}
            reload={sessions.reload}
          />
          {next && (
            <div className="upcoming-session">
              <div className="date-tile">
                <b>
                  {new Intl.DateTimeFormat("vi-VN", {
                    day: "2-digit",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(next.startAt))}
                </b>
                <span>
                  THÁNG{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    month: "numeric",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(next.startAt))}
                </span>
              </div>
              <div className="session-info">
                <Status value={next.status} />
                <h3>
                  {next.teacherId === actor.userId
                    ? "Bạn hướng dẫn"
                    : "Bạn đang học"}
                </h3>
                <p>{formatTime(next.startAt)}</p>
              </div>
              <Link
                className="btn btn-primary"
                href={"/learn/sessions/" + next.id}
              >
                Chi tiết
              </Link>
            </div>
          )}
          {!sessions.loading && !sessions.error && !next && (
            <Empty>Chưa có buổi học trong 30 ngày tới.</Empty>
          )}
        </Panel>
        <Panel>
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Kết nối mới</span>
              <h2>Đề nghị chờ phản hồi</h2>
            </div>
            <Link href="/learn/connections">Xem tất cả</Link>
          </div>
          <Feedback
            loading={proposals.loading}
            error={proposals.error}
            reload={proposals.reload}
          />
          {proposals.items.map((p) => (
            <Link
              className="product-pending"
              href={"/learn/connections/" + p.id}
              key={p.id}
            >
              <strong>
                <ProfileName id={p.proposerId} />
              </strong>
              <small className="learner-clamp">{p.message}</small>
            </Link>
          ))}
          {!proposals.loading &&
            !proposals.error &&
            !proposals.items.length && (
              <p className="muted">Bạn chưa có đề nghị đang chờ phản hồi.</p>
            )}
        </Panel>
      </div>
      <Panel>
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Học cùng nhau</span>
            <h2>Lộ trình gần đây</h2>
          </div>
          <Link href="/learn/paths">Xem lộ trình →</Link>
        </div>
        <Feedback
          loading={paths.loading}
          error={paths.error}
          reload={paths.reload}
        />
        <div className="product-dash-paths">
          {paths.items.slice(0, 4).map((p) => (
            <article key={p.id}>
              <Status value={p.status} />
              <h3>
                Học cùng <ProfileName id={p.counterpartId} />
              </h3>
              <p>
                {p.exchangeType === "TWO_WAY"
                  ? "Trao đổi kỹ năng hai chiều"
                  : p.exchangeType === "ONE_WAY"
                    ? "Hướng dẫn một chiều"
                    : "Đang thống nhất hình thức học"}
              </p>
              <Link className="learner-card-link" href={"/learn/paths/" + p.id}>
                Xem kế hoạch và lịch học →
              </Link>
            </article>
          ))}
        </div>
        {!paths.loading && !paths.error && !paths.items.length && (
          <Empty>
            Chưa có lộ trình.{" "}
            <Link href="/learn/explore">Khám phá cộng đồng</Link> để bắt đầu.
          </Empty>
        )}
      </Panel>
    </>
  );
}
