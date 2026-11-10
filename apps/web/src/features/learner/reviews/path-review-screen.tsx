"use client";
import Link from "next/link";
import { Back, Feedback, PageHeading, Panel } from "../components/common";
import { useUserResource } from "../hooks/use-user-resource";
import type { LearningPath } from "../types";
import { PathReviews } from "../paths/path-reviews";
import { ReviewEligibility } from "./review-eligibility";
import styles from "./reviews.module.css";

export function PathReviewScreen({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningPath>("learning-paths/" + id);
  const path = query.data;
  return (
    <div className={styles.page}>
      <Back href="/learn/reviews">Đánh giá của tôi</Back>
      <PageHeading
        title="Đánh giá lộ trình"
        description="Chia sẻ trải nghiệm học tập với đối tác sau khi thỏa thuận đã hoàn tất."
      />
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
      />
      {path && (
        <div className={styles.composeGrid}>
          <div>
            {path.status === "COMPLETED" && path.settledAt ? (
              <PathReviews key={path.id} path={path} />
            ) : (
              <ReviewEligibility key={path.id} pathId={path.id} />
            )}
          </div>
          <aside>
            <Panel title="Lộ trình được đánh giá">
              {path.plans.map((plan) => (
                <p key={plan.id}>{plan.learningGoal}</p>
              ))}
              <p className={styles.hint}>
                Đánh giá áp dụng cho toàn bộ thỏa thuận, gồm cả hai chiều nếu là
                trao đổi hai chiều.
              </p>
              <Link className="btn" href={"/learn/paths/" + id}>
                Xem lộ trình
              </Link>
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}
