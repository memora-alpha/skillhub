"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserList } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import type { Post } from "../types";
import {
  Empty,
  Feedback,
  More,
  PageHeading,
  Status,
} from "../components/common";
export function PostFeed() {
  const { actor } = useUserSession();
  const [mine, setMine] = useState(false),
    [search, setSearch] = useState(""),
    [keyword, setKeyword] = useState("");
  const query = useUserList<Post>(
    "learning-requests" +
      (mine ? "/mine" : "") +
      "?limit=20&keyword=" +
      encodeURIComponent(keyword),
  );
  return (
    <>
      <section className="learner-hero">
        <div>
          <p className="eyebrow">HỌC CÙNG NHAU, TIẾN XA HƠN</p>
          <h1>
            Hôm nay, bạn muốn
            <br />
            học điều gì mới?
          </h1>
          <p>
            Một cuộc trò chuyện có thể mở đầu cho kỹ năng tiếp theo của bạn.
          </p>
          <Link className="btn btn-primary" href="/learn/posts/new">
            Đăng bài tìm người hướng dẫn
          </Link>
        </div>
        <aside>
          <span className="learner-hero-number">01</span>
          <p>
            Một buổi học.
            <br />
            Một bước tiến.
          </p>
          <Link href="/learn/calendar">Xem lịch học của tôi →</Link>
        </aside>
      </section>
      <PageHeading
        title={mine ? "Bài đăng của tôi" : "Cộng đồng đang muốn học"}
        description={
          "Chào " + actor.profile.fullName + ", cùng tìm người phù hợp nhé."
        }
        action={
          <div className="learner-tabs">
            <button aria-pressed={!mine} onClick={() => setMine(false)}>
              Khám phá
            </button>
            <button aria-pressed={mine} onClick={() => setMine(true)}>
              Bài của tôi
            </button>
          </div>
        }
      />
      <form
        className="learner-search"
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(search.trim());
        }}
      >
        <input
          aria-label="Tìm bài đăng"
          placeholder="Tìm điều bạn quan tâm…"
          value={search}
          maxLength={120}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn">Tìm bài đăng</button>
      </form>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-post-grid">
        {query.items.map((post) => (
          <article className="learner-card learner-post-card" key={post.id}>
            <div className="learner-card-top">
              <span className="learner-skill-tag">
                {post.skill?.name ?? "Yêu cầu học"}
              </span>
              <Status value={post.status} />
            </div>
            <h2>
              <Link href={"/learn/posts/" + post.id}>{post.title}</Link>
            </h2>
            <p className="learner-clamp">
              {post.description ?? post.learningGoal}
            </p>
            <div className="learner-post-meta">
              <span>{post.owner?.displayName ?? actor.profile.fullName}</span>
              <strong>
                {post.desiredCreditPerHour
                  ? post.desiredCreditPerHour + " CR/giờ mong muốn"
                  : "Cùng thỏa thuận"}
              </strong>
            </div>
            <Link
              className="learner-card-link"
              href={"/learn/posts/" + post.id}
            >
              {mine ? "Quản lý bài đăng" : "Tìm hiểu và kết nối"} →
            </Link>
          </article>
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>
          {mine
            ? "Bạn chưa có bài đăng. Bắt đầu bằng điều bạn muốn học."
            : "Chưa có bài phù hợp. Thử từ khóa khác hoặc đăng bài của bạn."}
        </Empty>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </>
  );
}
