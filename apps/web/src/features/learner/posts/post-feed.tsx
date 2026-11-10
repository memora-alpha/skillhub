"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserList } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import type { Post, Skill } from "../types";
import { Empty, Feedback, More, PageHeading } from "../components/common";
import { PostCard } from "./post-card";
import { TagPicker } from "../tags/tag-picker";
import { ownPostStatuses, postFeedQuery } from "./post-feed-query";
export function PostFeed({
  initialKeyword = "",
  initialMine = false,
}: Readonly<{ initialKeyword?: string; initialMine?: boolean }>) {
  const { actor } = useUserSession();
  const skills = useUserList<Skill>("skills?limit=50");
  const [skillId, setSkillId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(initialMine),
    [search, setSearch] = useState(initialKeyword),
    [keyword, setKeyword] = useState(initialKeyword);
  const query = useUserList<Post>(
    postFeedQuery({ mine, keyword, skillId, tagIds, status }),
  );
  return (
    <>
      <PageHeading
        title={mine ? "Bài đăng của tôi" : "Khám phá nhu cầu học"}
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
          <div className="learner-form">
            {mine && (
              <label>
                <span>Trạng thái bài của tôi</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  {ownPostStatuses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <details>
              <summary>
                Lọc theo tag{tagIds.length ? ` (${tagIds.length})` : ""}
              </summary>
              <TagPicker
                ids={tagIds}
                proposed={[]}
                onChange={(ids) => setTagIds(ids)}
                disabled={false}
                allowProposals={false}
              />
            </details>
            {(skillId || tagIds.length > 0 || (mine && status) || keyword) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSkillId("");
                  setTagIds([]);
                  setStatus("");
                  setSearch("");
                  setKeyword("");
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
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
              <PostCard
                key={post.id}
                post={post}
                own={mine}
                fullName={
                  post.owner?.displayName ??
                  (mine ? actor.profile.fullName : "Thành viên SkillHub")
                }
                avatarUrl={
                  post.owner?.avatarUrl ??
                  (mine ? actor.profile.avatarUrl : null)
                }
                skillName={
                  post.skill?.name ??
                  skills.items.find((skill) => skill.id === post.skillId)?.name
                }
              />
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
