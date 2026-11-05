"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserList } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import type { Post, Skill } from "../types";
import {
  Empty,
  Feedback,
  More,
  PageHeading,
  Status,
} from "../components/common";
export function PostFeed({
  initialKeyword = "",
  initialMine = false,
}: Readonly<{ initialKeyword?: string; initialMine?: boolean }>) {
  const { actor } = useUserSession();
  const skills = useUserList<Skill>("skills?limit=50");
  const [skillId, setSkillId] = useState("");
  const [mine, setMine] = useState(initialMine),
    [search, setSearch] = useState(initialKeyword),
    [keyword, setKeyword] = useState(initialKeyword);
  const query = useUserList<Post>(
    "learning-requests" +
      (mine ? "/mine" : "") +
      "?limit=20&keyword=" +
      encodeURIComponent(keyword) +
      (skillId ? "&skillId=" + encodeURIComponent(skillId) : ""),
  );
  return (
    <>
      <PageHeading
        eyebrow="CÙNG NHAU HỌC ĐIỀU MỚI"
        title={mine ? "Bài đăng của tôi" : "Khám phá nhu cầu học"}
        description={
          "Chào " + actor.profile.fullName + ", cùng tìm người phù hợp nhé."
        }
        action={
          <div className="learner-tabs">
            <Link className="btn btn-primary" href="/learn/posts/new">
              + Đăng nhu cầu học
            </Link>
            <button
              type="button"
              aria-pressed={!mine}
              onClick={() => setMine(false)}
            >
              Khám phá
            </button>
            <button
              type="button"
              aria-pressed={mine}
              onClick={() => setMine(true)}
            >
              Bài của tôi
            </button>
          </div>
        }
      />
      <div className="explore-layout">
        <aside className="category-panel">
          <h3>Kỹ năng</h3>
          <button
            type="button"
            aria-pressed={!skillId}
            className={!skillId ? "active" : ""}
            onClick={() => setSkillId("")}
          >
            Tất cả kỹ năng
          </button>
          {skills.items.map((skill) => (
            <button
              type="button"
              key={skill.id}
              aria-pressed={skillId === skill.id}
              className={skillId === skill.id ? "active" : ""}
              onClick={() => setSkillId(skill.id)}
            >
              {skill.name}
            </button>
          ))}
          <Feedback
            loading={skills.loading}
            error={skills.error}
            reload={skills.reload}
          />
          <More
            cursor={skills.cursor}
            loading={skills.loading}
            onMore={() => {
              void skills.more();
            }}
          />
        </aside>
        <div>
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
            <button type="submit" className="btn">
              Tìm bài đăng
            </button>
          </form>
          <Feedback
            loading={query.loading}
            error={query.error}
            reload={query.reload}
          />
          <div className="learner-post-grid product-requests">
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
                  <span>
                    {post.owner?.displayName ??
                      (mine ? actor.profile.fullName : "Thành viên SkillHub")}
                  </span>
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
        </div>
      </div>
    </>
  );
}
