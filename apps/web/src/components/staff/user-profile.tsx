"use client";
import { useState } from "react";
import { Badge, Card, Empty } from "@/components/console/ui";
import { ProfileAvatar } from "@/features/learner/components/profile-avatar";
import type {
  PublicProfile,
  PublicSharingSkill,
} from "@/features/learner/discovery/discovery-types";
import type { ReviewSummary } from "@/features/learner/account/profile-reviews";
import { achievementCopy, achievementTitle } from "@/lib/i18n/system-copy";
import { systemCodeLabel } from "@/lib/system-text";
import { fmtDateTime } from "@/lib/console/format";
import { useStaffList, useStaffResource } from "./hooks";
import { Pager, QueueState } from "./common";
import { OperationReference } from "./operation-reference";
import styles from "./user-profile.module.css";

export function StaffUserProfile({ userId }: Readonly<{ userId: string }>) {
  const profile = useStaffResource<PublicProfile>(`profiles/${userId}`);
  const selectedTitle = profile.data?.selectedTitle;
  const titleLabel = selectedTitle
    ? achievementCopy({
        code: selectedTitle,
        title: achievementTitle(selectedTitle) ?? selectedTitle,
        description: "",
      }).title
    : null;
  return (
    <div className={styles.workspace}>
      <Card
        title="Hồ sơ người dùng"
        actions={
          <button
            type="button"
            className="btn"
            disabled={profile.loading}
            onClick={() => void profile.reload()}
          >
            Làm mới hồ sơ
          </button>
        }
      >
        <QueueState
          loading={profile.loading}
          error={profile.error}
          empty={!profile.data}
          reload={profile.reload}
          emptyTitle="Chưa có hồ sơ để hiển thị"
          emptyDescription="Kiểm tra lại mã người dùng."
        >
          {profile.data && (
            <>
              <div className={styles.header}>
                <ProfileAvatar
                  fullName={profile.data.fullName}
                  avatarUrl={profile.data.avatarUrl}
                  className={styles.avatar}
                />
                <div className={styles.identity}>
                  <h2>{profile.data.fullName}</h2>
                  <p>{profile.data.headline || "Thành viên SkillHub"}</p>
                  {profile.data.selectedTitle && (
                    <p>
                      <Badge tone="brand">{titleLabel}</Badge>
                    </p>
                  )}
                  <OperationReference id={userId} label="Mã người dùng" />
                </div>
              </div>
              <p className={styles.bio}>
                {profile.data.bio || "Thành viên chưa có giới thiệu công khai."}
              </p>
              <dl className={styles.stats}>
                <div>
                  <dt>Điểm uy tín</dt>
                  <dd>{profile.data.reputationScore}/100</dd>
                </div>
                <div>
                  <dt>Kỹ năng đã xác minh</dt>
                  <dd>{profile.data.verifiedSkillCount}</dd>
                </div>
                <div>
                  <dt>Lộ trình đã hoàn tất</dt>
                  <dd>{profile.data.completedLearningPathCount}</dd>
                </div>
                <div>
                  <dt>Buổi học đã hoàn thành</dt>
                  <dd>{profile.data.completedSessionCount}</dd>
                </div>
              </dl>
            </>
          )}
        </QueueState>
        {profile.error && (
          <p className="muted">
            Nếu hồ sơ công khai chưa khả dụng, bạn vẫn có thể kiểm tra nội dung
            kiểm duyệt bên dưới khi có quyền.
          </p>
        )}
      </Card>
      {profile.data && (
        <div className={styles.columns}>
          <UserSkills userId={userId} />
          <UserReviews userId={userId} summary={profile.data.reviewSummary} />
        </div>
      )}
    </div>
  );
}

function UserSkills({ userId }: Readonly<{ userId: string }>) {
  const skills = useStaffList<PublicSharingSkill>(
    `profiles/${userId}/skills?limit=20`,
  );
  return (
    <Card title="Kỹ năng đang chia sẻ">
      <QueueState
        loading={skills.loading}
        error={skills.error}
        empty={!skills.items.length}
        reload={skills.reload}
        emptyTitle="Chưa có kỹ năng công khai"
        emptyDescription="Kỹ năng đang chia sẻ sẽ xuất hiện tại đây."
      >
        {skills.items.map((skill) => (
          <article key={skill.id} className={styles.item}>
            <h3>{skill.skill.name}</h3>
            <div className={styles.meta}>
              <span>
                {skill.skillLevel?.name ||
                  systemCodeLabel(skill.level, "Chưa có thông tin cấp độ")}
              </span>
              {skill.verificationStatus === "VERIFIED" && (
                <Badge tone="ok">Đã xác minh</Badge>
              )}
              {skill.experienceYears !== null && (
                <span>{skill.experienceYears} năm kinh nghiệm</span>
              )}
            </div>
            <p>{skill.description || "Chưa có mô tả kỹ năng."}</p>
          </article>
        ))}
      </QueueState>
      <Pager
        loading={skills.loading}
        hasMore={skills.page?.hasMore}
        more={skills.more}
      />
    </Card>
  );
}

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { userId: string; displayName: string } | null;
};
type ReviewsPage = { items: Review[]; summary: ReviewSummary };
function UserReviews({
  userId,
  summary,
}: Readonly<{ userId: string; summary?: ReviewSummary }>) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ limit: "10" });
  if (cursors[page]) params.set("cursor", cursors[page]!);
  const reviews = useStaffResource<ReviewsPage>(
    `profiles/${userId}/reviews?${params}`,
  );
  const rating = reviews.data?.summary ?? summary;
  const next = reviews.pagination?.nextCursor;
  const repeated = !!next && cursors.slice(0, page + 1).includes(next);
  return (
    <Card title="Đánh giá đã nhận">
      {rating && (
        <div className={styles.summary}>
          <strong>
            {rating.averageRating === null
              ? "Chưa có đánh giá"
              : `${rating.averageRating.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/5`}
          </strong>
          <span>{rating.reviewCount} đánh giá</span>
          {rating.reviewCount > 0 && (
            <details>
              <summary>Phân bố số sao</summary>
              <div className={styles.distribution}>
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star}>
                    <span>{star} sao</span>
                    <span>
                      {rating.ratingDistribution[String(star)] ?? 0} đánh giá
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <QueueState
        loading={reviews.loading}
        error={reviews.error}
        empty={!reviews.data}
        reload={reviews.reload}
      >
        {reviews.data?.items.length === 0 && (
          <Empty
            title="Chưa có đánh giá công khai"
            desc="Đánh giá từ các lộ trình hoàn tất sẽ xuất hiện tại đây."
          />
        )}
        {reviews.data?.items.map((review) => (
          <article key={review.id} className={styles.item}>
            <h3>
              {review.reviewer?.displayName ?? "Thành viên không còn khả dụng"}
            </h3>
            <div className={styles.meta}>
              <span className={styles.rating}>★ {review.rating}/5</span>
              <time dateTime={review.createdAt}>
                {fmtDateTime(review.createdAt)}
              </time>
            </div>
            <p>{review.comment || "Không có nhận xét bằng chữ."}</p>
          </article>
        ))}
      </QueueState>
      {(page > 0 || next) && (
        <nav className={styles.pager} aria-label="Trang đánh giá công khai">
          <button
            type="button"
            className="btn"
            disabled={reviews.loading || page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Trang trước
          </button>
          <span className="muted">Trang {page + 1}</span>
          <button
            type="button"
            className="btn"
            disabled={reviews.loading || !!reviews.error || !next || repeated}
            onClick={() => {
              if (!next || repeated) return;
              setCursors((values) => [...values.slice(0, page + 1), next]);
              setPage((value) => value + 1);
            }}
          >
            Trang tiếp
          </button>
        </nav>
      )}
      {repeated && (
        <p role="alert" className="staff-error">
          Chưa tải được trang tiếp theo. Làm mới hồ sơ rồi thử lại.
        </p>
      )}
    </Card>
  );
}
