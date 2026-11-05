"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { findInPages } from "../api/find-page";
import { Feedback } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { ProfileAvatar } from "../components/profile-avatar";
import type { Post, Proposal } from "../types";
import { PostCreatedTime } from "./post-card";
import { PostProposalForm } from "./post-proposal-form";
import { postActions } from "./post-policy";
import styles from "./posts.module.css";

export function PostPublicActions({ post }: Readonly<{ post: Post }>) {
  const { actor, request } = useUserSession();
  const existing = useQuery({
    queryKey: ["learner", actor.userId, "post-proposal", post.id],
    queryFn: async () =>
      (await findInPages<Proposal>(
        request,
        "proposals?direction=sent&learningRequestId=" + post.id + "&limit=100",
        (row) =>
          row.sourceType === "LEARNING_REQUEST" &&
          row.learningRequestId === post.id &&
          ["PENDING", "ACCEPTED"].includes(row.status),
      )) ?? null,
  });
  return (
    <section className={styles.publicActions}>
      {post.owner && (
        <Link
          className={styles.author}
          href={"/learn/people/" + post.owner.id}
          aria-label={"Xem hồ sơ của " + post.owner.displayName}
        >
          <ProfileAvatar
            fullName={post.owner.displayName}
            avatarUrl={post.owner.avatarUrl}
            className={styles.avatar}
          />
          <div className={styles.identity}>
            <span className={styles.caption}>Người đăng yêu cầu</span>
            <strong>{post.owner.displayName}</strong>
            <PostCreatedTime value={post.createdAt} />
          </div>
          <ProductIcon name="chevron" size={17} />
        </Link>
      )}
      <Feedback
        loading={existing.isPending}
        error={existing.error?.message}
        reload={() => {
          void existing.refetch();
        }}
      />
      {existing.data ? (
        <>
          <p className={styles.caption}>
            {existing.data.status === "ACCEPTED"
              ? "Đề xuất đã được chấp nhận."
              : "Bạn đã gửi đề xuất, đang chờ phản hồi."}
          </p>
          <Link
            className="btn btn-primary"
            href={"/learn/connections/" + existing.data.id}
          >
            Xem đề xuất
          </Link>
        </>
      ) : (
        !existing.isPending &&
        !existing.error &&
        (postActions(post).propose ? (
          <details className={styles.proposal}>
            <summary>
              <ProductIcon name="send" size={17} />
              Gửi đề xuất
            </summary>
            <PostProposalForm post={post} />
          </details>
        ) : (
          <p className={styles.caption}>Bài không còn nhận đề xuất.</p>
        ))
      )}
    </section>
  );
}
