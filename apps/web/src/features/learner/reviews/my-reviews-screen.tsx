"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Feedback,
  More,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { useUserList } from "../hooks/use-user-resource";
import type { PathSummary } from "../types";
import { useMyReviews } from "./use-my-reviews";
import { ReviewStars } from "./review-stars";
import type { ReviewSummary } from "./review-contract";
import styles from "./reviews.module.css";

export function MyReviewsScreen() {
  const [direction, setDirection] = useState<"received" | "sent">("received");
  const [choosing, setChoosing] = useState(false);
  const query = useMyReviews(direction);
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="PHẢN HỒI SAU HỌC TẬP"
        title="Đánh giá của tôi"
        description="Xem phản hồi từ đối tác và những đánh giá bạn đã chia sẻ sau mỗi lộ trình."
        action={
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={choosing}
            aria-controls="choose-review-path"
            onClick={() => setChoosing(!choosing)}
          >
            <ProductIcon name="star" size={17} />{" "}
            {choosing ? "Đóng danh sách lộ trình" : "Đánh giá lộ trình"}
          </button>
        }
      />
      {choosing && <ChooseReviewPath />}
      <div className={styles.listHeader}>
        <div className={styles.tabs} aria-label="Loại đánh giá">
          {(
            [
              ["received", "Đã nhận"],
              ["sent", "Đã gửi"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={direction === value}
              className={direction === value ? styles.activeTab : ""}
              onClick={() => setDirection(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn"
          disabled={query.loading}
          onClick={query.reload}
        >
          <ProductIcon name="refresh" size={16} /> Làm mới
        </button>
      </div>

      {query.summary && <ReceivedSummary summary={query.summary} />}
      <section className={styles.listSection} aria-label="Danh sách đánh giá">
        <p className={styles.hint}>
          {direction === "received"
            ? "Những phản hồi đối tác đã dành cho bạn."
            : "Những đánh giá bạn đã gửi cho đối tác."}
        </p>
        <Feedback
          loading={query.initialLoading}
          error={query.error}
          reload={query.reload}
        />
        {!query.initialLoading && !query.error && !query.rows.length && (
          <div className={styles.empty}>
            <ProductIcon name="star" size={32} />
            <h2>
              {direction === "received"
                ? "Bạn chưa nhận được đánh giá"
                : "Bạn chưa gửi đánh giá nào"}
            </h2>
            <p>
              {direction === "received"
                ? "Phản hồi sẽ xuất hiện khi đối tác đánh giá sau một lộ trình đã hoàn tất."
                : "Chọn một lộ trình đã hoàn tất và quyết toán để chia sẻ trải nghiệm của bạn."}
            </p>
            {direction === "sent" && (
              <button
                type="button"
                className="btn"
                onClick={() => setChoosing(true)}
              >
                Chọn lộ trình
              </button>
            )}
          </div>
        )}
        <div className={styles.reviewList}>
          {query.rows.map((row) => {
            const person = direction === "sent" ? row.reviewee : row.reviewer;
            return (
              <article className={styles.reviewCard} key={row.id}>
                <div className={styles.reviewHeader}>
                  <div className={styles.person}>
                    <ProfileAvatar
                      fullName={person?.displayName ?? "Thành viên"}
                      avatarUrl={null}
                      className={styles.avatar}
                    />
                    <div>
                      {person ? (
                        <Link href={"/learn/people/" + person.userId}>
                          {person.displayName}
                        </Link>
                      ) : (
                        <strong>Thành viên</strong>
                      )}
                      <span>
                        {direction === "received"
                          ? "Đã đánh giá bạn"
                          : "Bạn đã đánh giá đối tác"}
                      </span>
                    </div>
                  </div>
                  <time dateTime={row.createdAt}>
                    {formatTime(row.createdAt)}
                  </time>
                </div>
                <div className={styles.cardRating}>
                  <ReviewStars rating={row.rating} />
                </div>
                <p className={styles.comment}>
                  {row.comment || "Không có nhận xét thêm."}
                </p>
              </article>
            );
          })}
        </div>
        <More
          cursor={query.cursor}
          loading={query.loading}
          onMore={query.more}
        />
      </section>
    </div>
  );
}

function ReceivedSummary({ summary }: Readonly<{ summary: ReviewSummary }>) {
  return (
    <Panel className={styles.summary}>
      <div className={styles.score}>
        <span>Đánh giá bạn đã nhận</span>
        <strong>
          {summary.averageRating === null
            ? "—"
            : summary.averageRating.toFixed(2)}
          <small> / 5</small>
        </strong>
        {summary.averageRating !== null && (
          <ReviewStars rating={Math.round(summary.averageRating)} />
        )}
        <p>{summary.reviewCount} đánh giá từ đối tác</p>
      </div>
      <div className={styles.distribution} aria-label="Phân bố số sao đã nhận">
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n}>
            <span>{n} sao</span>
            <progress
              aria-label={`${n} sao`}
              value={summary.ratingDistribution[String(n)] ?? 0}
              max={summary.reviewCount || 1}
            />
            <strong>{summary.ratingDistribution[String(n)] ?? 0}</strong>
          </div>
        ))}
      </div>
      <p className={styles.summaryNote}>
        Điểm trung bình và phân bố sao là đánh giá bạn đã nhận, kể cả khi xem
        tab đã gửi.
      </p>
    </Panel>
  );
}

function ChooseReviewPath() {
  const query = useUserList<PathSummary & { title?: string | null }>(
    "learning-paths/mine?limit=20",
  );
  const completed = query.items.filter((row) => row.status === "COMPLETED");
  return (
    <section id="choose-review-path">
      <Panel title="Chọn lộ trình đã hoàn tất">
        <p className={styles.hint}>
          Mỗi người đánh giá đối phương một lần cho mỗi lộ trình đã quyết toán.
        </p>
        <Feedback
          loading={query.initialLoading}
          error={query.error}
          reload={query.reload}
        />
        <div className={styles.pathList}>
          {completed.map((path) => (
            <Link key={path.id} href={`/learn/paths/${path.id}/review`}>
              <span>
                <strong>{path.title || "Lộ trình học tập"}</strong>
                <small>Viết đánh giá hoặc xem phản hồi đã gửi</small>
              </span>
              <ProductIcon name="arrow" size={18} />
            </Link>
          ))}
        </div>
        {!query.loading && !query.error && !completed.length && (
          <p>
            Chưa có lộ trình hoàn tất trong danh sách đã tải.
            {query.cursor ? " Xem thêm để tìm các lộ trình trước đó." : ""}
          </p>
        )}
        <More
          cursor={query.cursor}
          loading={query.loading}
          onMore={() => {
            void query.more();
          }}
        />
      </Panel>
    </section>
  );
}
