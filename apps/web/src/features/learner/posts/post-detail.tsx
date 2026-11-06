"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { Back, CommandFeedback, Feedback } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import type { Post } from "../types";
import { postActions } from "./post-policy";
import { postCredit } from "./post-presentation";
import { PostDetailContent } from "./post-detail-content";
import { PostPublicActions } from "./post-public-actions";
import styles from "./posts.module.css";

export function PostDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<Post>("learning-requests/" + id);
  const post = query.data;
  const owner = !!post && !post.owner;
  const actions = post ? postActions(post) : undefined;
  return (
    <>
      <Back href={owner ? "/learn/explore?mine=true" : "/learn/explore"} />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {post && actions && (
        <div className={styles.detailLayout}>
          <div className={styles.content}>
            <PostDetailContent
              post={post}
              owner={owner}
              expired={actions.expired}
            />
          </div>
          <aside
            className={styles.sidebar}
            aria-label="Credit và thao tác bài đăng"
          >
            <section className={styles.budget}>
              <h2 className={styles.sectionTitle}>
                <ProductIcon name="wallet" size={18} />
                {owner ? "Credit mong muốn" : "Ngân sách mong muốn"}
              </h2>
              <p className={styles.credit}>
                {postCredit(post.desiredCreditPerHour)}
                {post.desiredCreditPerHour && <span> / giờ</span>}
              </p>
              <p>Mức tham khảo, sẽ được hai bên thỏa thuận.</p>
            </section>
            {owner ? (
              <PostOwnerActions post={post} />
            ) : (
              <PostPublicActions post={post} />
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function PostOwnerActions({ post }: Readonly<{ post: Post }>) {
  const { request } = useUserSession();
  const command = useUserCommand();
  const [cancelling, setCancelling] = useState(false);
  const actions = postActions(post);
  const id = post.id;
  if (!actions.edit && !actions.publish && !actions.cancel && !post.publishedAt)
    return null;
  return (
    <section className={styles.ownerActions}>
      <h2>Quản lý bài đăng</h2>
      <div className="learner-actions">
        {actions.edit && (
          <Link className="btn" href={"/learn/posts/" + id + "/edit"}>
            {post.status === "REJECTED"
              ? "Chỉnh sửa và gửi duyệt lại"
              : "Chỉnh sửa"}
          </Link>
        )}
        {actions.publish && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={command.pending || command.uncertain}
            onClick={() => {
              void command.run("publish:" + id + ":" + post.version, () =>
                request("learning-requests/" + id + "/publish", {
                  method: "POST",
                  body: { expectedVersion: post.version },
                }),
              );
            }}
          >
            Đăng yêu cầu
          </button>
        )}
        {post.publishedAt && (
          <Link
            className="btn"
            href={
              "/learn/connections?direction=received&learningRequestId=" + id
            }
          >
            Xem đề xuất nhận được
          </Link>
        )}
        {actions.cancel && (
          <button
            type="button"
            className="btn"
            disabled={command.pending || command.uncertain}
            onClick={() => setCancelling(true)}
          >
            Hủy bài đăng
          </button>
        )}
      </div>
      {cancelling && actions.cancel && (
        <div className="learner-notice">
          <p>Bài sẽ ngừng nhận đề xuất mới. Lịch sử đề xuất vẫn được giữ.</p>
          <div className="learner-actions">
            <button
              type="button"
              className="btn"
              disabled={command.pending || command.uncertain}
              onClick={() => {
                void command
                  .run("cancel:" + id + ":" + post.version, () =>
                    request("learning-requests/" + id + "/cancel", {
                      method: "POST",
                      body: { expectedVersion: post.version },
                    }),
                  )
                  .then((result) => {
                    if (result) setCancelling(false);
                  });
              }}
            >
              Xác nhận hủy
            </button>
            <button
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => setCancelling(false)}
            >
              Giữ bài
            </button>
          </div>
        </div>
      )}
      <CommandFeedback command={command} />
    </section>
  );
}
