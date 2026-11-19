"use client";
import Link from "next/link";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useState, type ReactNode } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { OwnIdentity } from "../account/account-types";
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
import { LearnerContentSkeleton } from "../components/learner-skeleton";
import { ProfileName } from "../components/profile-name";

export function DashboardScreen() {
  const { actor } = useUserSession();
  const [now] = useState(() => new Date());
  const range = new URLSearchParams({
    from: now.toISOString(),
    to: new Date(now.getTime() + 30 * 86400000).toISOString(),
  });
  const identity = useUserResource<OwnIdentity>("me"),
    sessions = useUserResource<LearningSession[]>("sessions/mine?" + range),
    paths = useUserList<PathSummary>("learning-paths/mine?limit=6"),
    proposals = useUserList<Proposal>(
      "proposals?direction=received&status=PENDING&limit=5",
    ),
    wallet = useUserResource<{ availableCredit: string; heldCredit: string }>(
      "me/wallet",
    );

  const upcoming = sessions.data
    ?.filter((s) => !["CANCELLED", "COMPLETED", "CLOSED"].includes(s.status))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const next = upcoming?.[0];

  let nextLabel: ReactNode = "Chưa có lịch";
  if (next)
    nextLabel = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(next.startAt));
  else if (sessions.loading) nextLabel = <LoadingSkeleton variant="inline" />;
  else if (sessions.error) nextLabel = "Chưa tải được";

  let pathsLabel: ReactNode =
    paths.items.length + (paths.cursor ? "+" : "") + " lộ trình";
  if (paths.loading && !paths.items.length)
    pathsLabel = <LoadingSkeleton variant="inline" />;
  else if (paths.error) pathsLabel = "Chưa tải được";

  let walletLabel: ReactNode = "Chưa tải được";
  if (wallet.data) walletLabel = wallet.data.availableCredit + " CR";
  else if (wallet.loading) walletLabel = <LoadingSkeleton variant="inline" />;

  const reputationScore = identity.data?.profile.reputationScore;
  const verifiedSkills = identity.data?.profile.verifiedSkillCount ?? 0;
  const lowReputation =
    typeof reputationScore === "number" && reputationScore < 40;

  let reputationLabel: ReactNode = "50/100";
  if (typeof reputationScore === "number")
    reputationLabel = `${reputationScore}/100`;
  else if (identity.loading)
    reputationLabel = <LoadingSkeleton variant="inline" />;
  else if (identity.error) reputationLabel = "Chưa tải được";

  if (sessions.initialLoading || paths.initialLoading || wallet.initialLoading)
    return <LearnerContentSkeleton />;

  const displayName = identity.data?.profile.fullName ?? actor.profile.fullName;

  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "full",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(now)}
        title={"Xin chào, " + displayName + "."}
        description="Theo dõi buổi học 1:1, thỏa thuận trao đổi 2 chiều / 1 chiều, ví Credit và điểm uy tín của bạn."
        action={
          <div className="learner-actions">
            <Link className="btn" href="/learn/explore?view=sharers">
              <ProductIcon name="search" size={16} />
              Tìm người chia sẻ
            </Link>
            <Link className="btn btn-primary" href="/learn/posts/new">
              <ProductIcon name="plus" size={17} />
              Đăng nhu cầu học
            </Link>
          </div>
        }
      />

      <section className="stat-grid" aria-label="Tổng quan học tập">
        <Link className="stat-card" href="/learn/calendar">
          <span className="stat-icon sage">
            <ProductIcon name="calendar" />
          </span>
          <div>
            <small>Buổi học gần nhất</small>
            <strong>{nextLabel}</strong>
            <b>
              {upcoming && upcoming.length > 1
                ? `${upcoming.length} buổi trong 30 ngày tới`
                : "Trong 30 ngày tới"}
            </b>
          </div>
        </Link>

        <Link className="stat-card" href="/learn/paths">
          <span className="stat-icon orange">
            <ProductIcon name="book" />
          </span>
          <div>
            <small>Lộ trình của bạn</small>
            <strong>{pathsLabel}</strong>
            <b>Trao đổi 2 chiều &amp; học 1 chiều</b>
          </div>
        </Link>

        <Link className="stat-card" href="/learn/wallet">
          <span className="stat-icon forest">
            <ProductIcon name="wallet" />
          </span>
          <div>
            <small>Credit khả dụng</small>
            <strong>{walletLabel}</strong>
            <b>
              {wallet.data
                ? wallet.data.heldCredit + " CR đang tạm giữ"
                : "1.000 VNĐ = 1 Credit"}
            </b>
          </div>
        </Link>

        <Link
          className="stat-card"
          href="/learn/reputation"
          data-alert={lowReputation}
        >
          <span className="stat-icon cream">
            <ProductIcon name="shield" />
          </span>
          <div>
            <small>Điểm uy tín</small>
            <strong>{reputationLabel}</strong>
            <b>
              {lowReputation
                ? "Xem nhiệm vụ phục hồi →"
                : `${verifiedSkills} kỹ năng đã xác minh`}
            </b>
          </div>
        </Link>
      </section>

      {!paths.loading && !paths.items.length && (
        <section className="journey-strip" aria-label="Bắt đầu trên SkillHub">
          <Link className="journey-step" href="/learn/skills">
            <span>01</span>
            <div>
              <strong>Khai báo kỹ năng</strong>
              <small>Thêm kỹ năng bạn có thể chia sẻ và nộp xác minh.</small>
            </div>
          </Link>
          <Link className="journey-step" href="/learn/explore">
            <span>02</span>
            <div>
              <strong>Khám phá &amp; kết nối</strong>
              <small>
                Đăng nhu cầu học hoặc gửi lời mời tới người chia sẻ.
              </small>
            </div>
          </Link>
          <Link className="journey-step" href="/learn/messages">
            <span>03</span>
            <div>
              <strong>Chat &amp; chốt lộ trình</strong>
              <small>
                Chọn 2 chiều hoặc 1 chiều, xác nhận kế hoạch &amp; lịch.
              </small>
            </div>
          </Link>
          <Link className="journey-step" href="/learn/wallet">
            <span>04</span>
            <div>
              <strong>Học 1:1 &amp; quyết toán</strong>
              <small>Hoàn thành toàn bộ buổi học để quyết toán 96% / 4%.</small>
            </div>
          </Link>
        </section>
      )}

      <Feedback error={wallet.error} reload={wallet.reload} />

      <div className="dashboard-columns">
        <Panel>
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Phòng học LiveKit 1:1</span>
              <h2>Buổi học sắp tới</h2>
            </div>
            <Link href="/learn/calendar">Mở lịch học →</Link>
          </div>
          <Feedback
            loading={sessions.initialLoading}
            error={sessions.error}
            reload={sessions.reload}
            refreshing={!!(sessions.loading && !sessions.initialLoading)}
          />
          {upcoming?.slice(0, 2).map((session) => (
            <div className="upcoming-session" key={session.id}>
              <div className="date-tile">
                <b>
                  {new Intl.DateTimeFormat("vi-VN", {
                    day: "2-digit",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(session.startAt))}
                </b>
                <span>
                  TH{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    month: "numeric",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(session.startAt))}
                </span>
              </div>
              <div className="session-info">
                <Status value={session.status} />
                <h3>
                  {session.teacherId === actor.userId
                    ? "Bạn hướng dẫn"
                    : "Bạn đang học"}
                </h3>
                <p>{formatTime(session.startAt)}</p>
              </div>
              <Link
                className="btn btn-primary"
                href={"/learn/sessions/" + session.id}
              >
                Chi tiết
              </Link>
            </div>
          ))}
          {!sessions.loading && !sessions.error && !next && (
            <Empty>
              Chưa có buổi học trong 30 ngày tới.{" "}
              <Link href="/learn/paths">Xem lộ trình</Link> hoặc{" "}
              <Link href="/learn/explore">khám phá cộng đồng</Link>.
            </Empty>
          )}
        </Panel>

        <Panel>
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Kết nối mới</span>
              <h2>Đề nghị chờ phản hồi</h2>
            </div>
            <Link href="/learn/connections">Xem tất cả →</Link>
          </div>
          <Feedback
            loading={proposals.initialLoading}
            error={proposals.error}
            reload={proposals.reload}
            refreshing={!!(proposals.loading && !proposals.initialLoading)}
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
              <p className="muted">
                Bạn chưa có đề nghị nào đang chờ phản hồi. Chấp nhận đề nghị sẽ
                mở Chat để hai bên thương lượng lộ trình.
              </p>
            )}
        </Panel>
      </div>

      <Panel>
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Học cùng nhau</span>
            <h2>Lộ trình gần đây</h2>
          </div>
          <Link href="/learn/paths">Xem tất cả lộ trình →</Link>
        </div>
        <Feedback
          loading={paths.initialLoading}
          error={paths.error}
          reload={paths.reload}
          refreshing={!!(paths.loading && !paths.initialLoading)}
        />
        <div className="product-dash-paths">
          {paths.items.slice(0, 4).map((p) => (
            <article key={p.id}>
              <div className="learner-card-top">
                <Status value={p.status} />
                <span
                  className="exchange-pill"
                  data-type={p.exchangeType ?? undefined}
                >
                  {exchangeLabels[p.exchangeType ?? ""] ?? "Đang thống nhất"}
                </span>
              </div>
              <h3>
                {p.title?.trim() || (
                  <>
                    Học cùng <ProfileName id={p.counterpartId} />
                  </>
                )}
              </h3>
              <p>
                Đối tác: <ProfileName id={p.counterpartId} />
              </p>
              <Link className="learner-card-link" href={"/learn/paths/" + p.id}>
                Mở kế hoạch &amp; lịch học →
              </Link>
            </article>
          ))}
        </div>
        {!paths.loading && !paths.error && !paths.items.length && (
          <Empty>
            Chưa có lộ trình học nào.{" "}
            <Link href="/learn/explore">Khám phá cộng đồng</Link> để kết nối và
            tạo thỏa thuận đầu tiên.
          </Empty>
        )}
      </Panel>
    </>
  );
}

const exchangeLabels: Record<string, string> = {
  TWO_WAY: "Trao đổi 2 chiều",
  ONE_WAY: "Học 1 chiều",
};
