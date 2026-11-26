"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { useUserList } from "../hooks/use-user-resource";
import Link from "next/link";
import { useState } from "react";
import { SearchInput } from "@/components/search-input";

import { useUserSession } from "../auth/session";
import type { Post, Skill } from "../types";
import type { Tag } from "../tags/tag-policy";
import { Empty, Feedback, PageHeading } from "../components/common";
import { PostCard } from "./post-card";

const requestStatusOptions: readonly [string, string][] = [
  ["DRAFT", "Bản nháp"],
  ["PENDING_MODERATION", "Chờ kiểm duyệt"],
  ["OPEN", "Đang mở"],
  ["REJECTED", "Cần chỉnh sửa"],
  ["NEGOTIATING", "Đang thương lượng"],
  ["MATCHED", "Đã kết nối"],
  ["CLOSED", "Đã đóng"],
  ["CANCELLED", "Đã hủy"],
  ["EXPIRED", "Đã hết hạn"],
];

export function PostFeed({
  initialKeyword = "",
  initialMine = false,
  initialSkillId = "",
}: Readonly<{
  initialKeyword?: string;
  initialMine?: boolean;
  initialSkillId?: string;
}>) {
  const { actor } = useUserSession();
  const skills = useUserPagedList<Skill>("skills?limit=50");
  const [recommended, setRecommended] = useState(false);
  const [status, setStatus] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [tagTerm, setTagTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [skillId, setSkillId] = useState(initialSkillId);
  const [mine, setMine] = useState(initialMine),
    [search, setSearch] = useState(initialKeyword),
    [keyword, setKeyword] = useState(initialKeyword);
  const tagQuery = useUserList<Tag>(
    "tags?limit=20" + (tagTerm ? "&q=" + encodeURIComponent(tagTerm) : ""),
  );
  const query = useUserPagedList<Post>(
    "learning-requests" +
      (mine ? "/mine" : recommended ? "/recommended" : "") +
      "?limit=20&keyword=" +
      encodeURIComponent(keyword) +
      (skillId ? "&skillId=" + encodeURIComponent(skillId) : "") +
      (mine && status ? "&status=" + status : "") +
      selectedTags
        .map((tag) => "&tagIds=" + encodeURIComponent(tag.id))
        .join(""),
  );
  function toggleTag(tag: Tag) {
    setSelectedTags((previous) => {
      if (previous.some((item) => item.id === tag.id))
        return previous.filter((item) => item.id !== tag.id);
      if (previous.length >= 10) return previous;
      return [...previous, tag];
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="Cộng đồng SkillHub"
        title={mine ? "Bài nhu cầu học của tôi" : "Khám phá nhu cầu học"}
        description={
          mine
            ? "Quản lý các bài đăng bạn đã tạo, theo dõi trạng thái kiểm duyệt và đề nghị nhận được."
            : "Tìm người cần học đúng kỹ năng bạn có thể chia sẻ để gửi đề nghị trao đổi 2 chiều hoặc dạy 1 chiều."
        }
        action={
          <div className="learner-actions">
            <div
              className="learner-tabs"
              role="group"
              aria-label="Phạm vi bài đăng"
            >
              <button
                type="button"
                aria-pressed={!mine && !recommended}
                onClick={() => {
                  setMine(false);
                  setRecommended(false);
                }}
              >
                Cộng đồng
              </button>
              <button
                type="button"
                aria-pressed={!mine && recommended}
                onClick={() => {
                  setMine(false);
                  setRecommended(true);
                }}
              >
                Phù hợp với tôi
              </button>
              <button
                type="button"
                aria-pressed={mine}
                onClick={() => setMine(true)}
              >
                Bài của tôi
              </button>
            </div>
            <Link className="btn btn-primary" href="/learn/posts/new">
              + Đăng nhu cầu học
            </Link>
          </div>
        }
      />
      {mine && (
        <label>
          Trạng thái bài đăng
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả</option>
            {requestStatusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <details>
        <summary>
          Lọc theo tag
          {selectedTags.length ? ` (${selectedTags.length}/10)` : ""}
        </summary>
        <div className="learner-stack">
          <div className="learner-search">
            <SearchInput
              aria-label="Tìm tag để lọc"
              placeholder="Tìm tên tag…"
              value={tagSearch}
              maxLength={120}
              onChange={setTagSearch}
              onSearch={setTagTerm}
            />
          </div>
          <div className="learner-choice-list">
            {tagQuery.items.map((tag) => {
              const active = selectedTags.some((item) => item.id === tag.id);
              return (
                <button
                  type="button"
                  key={tag.id}
                  className={"learner-choice " + (active ? "selected" : "")}
                  aria-pressed={active}
                  disabled={!active && selectedTags.length >= 10}
                  onClick={() => toggleTag(tag)}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          {!!selectedTags.length && (
            <div className="learner-actions">
              {selectedTags.map((tag) => (
                <button
                  type="button"
                  className="btn"
                  key={tag.id}
                  onClick={() => toggleTag(tag)}
                >
                  Bỏ {tag.label} ×
                </button>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedTags([])}
              >
                Xóa lọc tag
              </button>
            </div>
          )}
        </div>
      </details>
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
            loading={skills.initialLoading}
            error={skills.error}
            reload={skills.reload}
            refreshing={!!(skills.loading && !skills.initialLoading)}
          />
          <ListPagination query={skills} />
        </aside>
        <div>
          <div className="learner-search">
            <SearchInput
              aria-label="Tìm bài đăng"
              placeholder="Tìm điều bạn quan tâm…"
              value={search}
              maxLength={120}
              onChange={setSearch}
              onSearch={setKeyword}
            />
          </div>
          <Feedback
            loading={query.initialLoading}
            error={query.error}
            reload={query.reload}
            refreshing={!!(query.loading && !query.initialLoading)}
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
          <ListPagination query={query} />
        </div>
      </div>
    </>
  );
}
