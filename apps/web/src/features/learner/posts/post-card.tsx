"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ProfileAvatar } from "../components/profile-avatar";
import { ProductIcon } from "../components/product-icon";
import { Status, formatTime } from "../components/common";
import type { Post } from "../types";
import { PostSkillName } from "./post-catalog";
import {
  postAge,
  postCredit,
  postDisplayState,
  postLevels,
  postStatusLabel,
} from "./post-presentation";
import styles from "./posts.module.css";

const currentMinute = () => Math.floor(Date.now() / 60000) * 60000;
const serverMinute = () => 0;
function subscribeMinute(listener: () => void) {
  const timer = setInterval(listener, 60000);
  return () => clearInterval(timer);
}
export function PostCreatedTime({ value }: Readonly<{ value: string }>) {
  const now = useSyncExternalStore(
    subscribeMinute,
    currentMinute,
    serverMinute,
  );
  if (!Number.isFinite(Date.parse(value))) return null;
  return (
    <time dateTime={value} title={formatTime(value)}>
      {now ? postAge(value, now) : formatTime(value)}
    </time>
  );
}

export function PostCard({
  post,
  own,
  fullName,
  avatarUrl,
  skillName,
}: Readonly<{
  post: Post;
  own: boolean;
  fullName: string;
  avatarUrl: string | null;
  skillName?: string;
}>) {
  const tags = [
    ...new Set(
      [
        skillName,
        post.currentLevel
          ? (postLevels[post.currentLevel] ?? post.currentLevel)
          : undefined,
        ...(post.tags?.map((tag) => tag.label) ?? []),
      ].filter((label): label is string => !!label),
    ),
  ];
  const visibleTags = skillName ? 3 : 2;
  return (
    <article className={styles.card}>
      <Link
        className={styles.cardLink}
        href={"/learn/posts/" + post.id}
        aria-label={"Xem bài: " + post.title}
      >
        <header className={styles.cardHeader}>
          <div className={styles.person}>
            <ProfileAvatar
              fullName={fullName}
              avatarUrl={avatarUrl}
              className={styles.avatar}
            />
            <div className={styles.identity}>
              <strong>{own ? "Bạn" : fullName}</strong>
              <PostCreatedTime value={post.createdAt} />
            </div>
          </div>
          <Status
            value={postDisplayState(post)}
            label={postStatusLabel(post)}
          />
        </header>
        <h2 className={styles.cardTitle}>{post.title}</h2>
        <div className={styles.tags}>
          {!skillName && (
            <span className={styles.tag}>
              <PostSkillName id={post.skillId} />
            </span>
          )}
          {tags.slice(0, visibleTags).map((tag) => (
            <span className={styles.tag} key={tag}>
              {tag}
            </span>
          ))}
          {tags.length > visibleTags && (
            <span
              className={styles.tag}
              aria-label={`Còn ${tags.length - visibleTags} chủ đề`}
            >
              +{tags.length - visibleTags}
            </span>
          )}
        </div>
        {own && !!post.proposedTags?.length && (
          <p className={styles.caption}>
            {post.proposedTags.length} tag đề xuất
          </p>
        )}
        <footer className={styles.cardFooter}>
          <span>
            <strong>{postCredit(post.desiredCreditPerHour)}</strong>
            {post.desiredCreditPerHour && (
              <span className={styles.caption}> / giờ</span>
            )}
          </span>
          <ProductIcon name="chevron" size={18} />
        </footer>
      </Link>
    </article>
  );
}
