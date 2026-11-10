"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserList } from "../hooks/use-user-resource";
import { Feedback, More, Panel, formatTime } from "../components/common";
export type ReviewSummary = {
  reviewCount: number;
  averageRating: number | null;
  ratingDistribution: Record<string, number>;
};
type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { userId: string; displayName: string } | null;
  reviewee?: { userId: string; displayName: string } | null;
};
export function RatingSummary({
  summary,
}: Readonly<{ summary?: ReviewSummary }>) {
  return summary ? (
    <div>
      <strong>
        {summary.averageRating === null
          ? "Chưa có đánh giá"
          : summary.averageRating.toFixed(1) + "/5"}
      </strong>
      <span> · {summary.reviewCount} đánh giá</span>
      <details>
        <summary>Phân bố số sao</summary>
        {[5, 4, 3, 2, 1].map((star) => (
          <p key={star}>
            {star} sao: {summary.ratingDistribution[String(star)] ?? 0}
          </p>
        ))}
      </details>
    </div>
  ) : null;
}
export function ProfileReviews({
  userId,
  own = false,
}: Readonly<{ userId: string; own?: boolean }>) {
  const [direction, setDirection] = useState("received");
  const query = useUserList<Review>(
    own
      ? `me/reviews?direction=${direction}&limit=20`
      : `profiles/${userId}/reviews?limit=20`,
    true,
  );
  return (
    <Panel title="Đánh giá">
      {own && (
        <div className="learner-actions">
          {[
            ["received", "Đã nhận"],
            ["sent", "Đã gửi"],
          ].map(([value, label]) => (
            <button
              className="btn"
              aria-pressed={direction === value}
              key={value}
              onClick={() => setDirection(value!)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.items.map((row) => {
        const person = direction === "sent" ? row.reviewee : row.reviewer;
        return (
          <article key={row.id}>
            <p>
              <strong>{row.rating}/5 sao</strong> ·{" "}
              {person ? (
                <Link href={"/learn/people/" + person.userId}>
                  {person.displayName}
                </Link>
              ) : (
                "Thành viên"
              )}{" "}
              · {formatTime(row.createdAt)}
            </p>
            {row.comment && <p className="learner-prose">{row.comment}</p>}
          </article>
        );
      })}
      {!query.loading && !query.error && !query.items.length && (
        <p>Chưa có đánh giá.</p>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </Panel>
  );
}
