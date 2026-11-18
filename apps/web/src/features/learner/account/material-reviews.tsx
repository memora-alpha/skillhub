"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
import { useState } from "react";
import { formText } from "../components/form-data";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { UserApiError } from "../api/client";
import {
  CommandFeedback,
  Feedback,
  Panel,
  formatTime,
} from "../components/common";
import { reportReasons } from "./report-reasons";
import type { MaterialRatingSummary } from "../types";
import styles from "./material-reviews.module.css";

type OwnReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  version: number;
};
type Review = OwnReview & {
  reviewer: { userId: string; fullName: string };
  verifiedPurchase: boolean;
  createdAt: string;
};
type Eligibility = {
  canReview: boolean;
  canEdit: boolean;
  editReasonCode: string | null;
  reasonCode: string | null;
  currentReview: OwnReview | null;
};
const eligibilityLabels: Record<string, string> = {
  MATERIAL_NOT_PUBLISHED: "Tài liệu hiện chưa mở đánh giá.",
  MATERIAL_OWNER_CANNOT_REVIEW: "Bạn không thể tự đánh giá tài liệu của mình.",
  MATERIAL_REVIEW_HIDDEN: "Đánh giá của bạn đang được ẩn sau kiểm duyệt.",
  MATERIAL_REVIEW_ALREADY_EXISTS: "Bạn đã đánh giá tài liệu này.",
  MATERIAL_ACCESS_REQUIRED: "Tải tài liệu miễn phí trước để chia sẻ đánh giá.",
  MATERIAL_PURCHASE_REQUIRED: "Mua tài liệu trước để chia sẻ đánh giá.",
  MATERIAL_ENTITLEMENT_REVOKED:
    "Quyền truy cập đã thay đổi nên chưa thể gửi đánh giá.",
};
export function MaterialRating({
  summary,
}: Readonly<{ summary?: MaterialRatingSummary }>) {
  if (!summary?.total) return <small className="muted">Chưa có đánh giá</small>;
  return (
    <span
      aria-label={`${summary.average} trên 5 sao, ${summary.total} đánh giá`}
    >
      ★ {summary.average}{" "}
      <small className="muted">({summary.total} đánh giá)</small>
    </span>
  );
}
export function MaterialReviews({
  materialId,
}: Readonly<{ materialId: string }>) {
  const { actor } = useUserSession();
  const list = useUserPagedList<Review>(
    `materials/${materialId}/reviews?limit=10`,
  );
  const eligibility = useUserResource<Eligibility>(
    `materials/${materialId}/review-eligibility`,
  );
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState<Review>();
  const own = eligibility.data?.currentReview;
  const reload = () => {
    list.reload();
    eligibility.reload();
  };
  return (
    <Panel title="Đánh giá tài liệu">
      <Feedback
        loading={list.initialLoading || eligibility.initialLoading}
        error={list.error || eligibility.error}
        reload={reload}
        refreshing={
          !!(
            (list.loading || eligibility.loading) &&
            !(list.initialLoading || eligibility.initialLoading)
          )
        }
      />
      <MaterialRating summary={list.ratingSummary} />
      {list.ratingSummary && list.ratingSummary.total > 0 && (
        <details className={styles.distribution}>
          <summary>Phân bố số sao</summary>
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star}>
              <span>{star} sao</span>
              <progress
                max={list.ratingSummary!.total}
                value={list.ratingSummary!.stars[String(star)] ?? 0}
              />
              <span>{list.ratingSummary!.stars[String(star)] ?? 0}</span>
            </div>
          ))}
        </details>
      )}
      {eligibility.data?.canReview ||
      (editing && eligibility.data?.canEdit === true) ? (
        <ReviewEditor
          key={own ? `${own.id}:${own.version}` : "new"}
          materialId={materialId}
          own={own}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
          onCancel={own ? () => setEditing(false) : undefined}
        />
      ) : (
        <div className={styles.own}>
          <p>
            {eligibilityLabels[eligibility.data?.reasonCode ?? ""] ??
              (eligibility.initialLoading ? (
                <LoadingSkeleton
                  variant="inline"
                  label="Đang kiểm tra điều kiện đánh giá"
                />
              ) : (
                "Chưa có thông tin về điều kiện đánh giá."
              ))}
          </p>
          {own && (
            <>
              <strong>Đánh giá của bạn: {own.rating}/5</strong>
              <p>{own.comment || "Không có nhận xét bằng chữ."}</p>
              {eligibility.data?.canEdit === true && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing(true)}
                >
                  Sửa đánh giá
                </button>
              )}
              <RemoveReview review={own} onRemoved={reload} />
              {eligibility.data?.canEdit === false && (
                <p className="muted">
                  {eligibilityLabels[eligibility.data.editReasonCode ?? ""] ??
                    "Đánh giá hiện không thể chỉnh sửa do quyền truy cập hoặc trạng thái tài liệu đã thay đổi."}
                </p>
              )}
            </>
          )}
        </div>
      )}
      <div className={styles.list}>
        {list.items.map((review) => (
          <article key={review.id} className={styles.review}>
            <div className={styles.row}>
              <Link href={`/learn/people/${review.reviewer.userId}`}>
                {review.reviewer.fullName}
              </Link>
              <strong aria-label={`${review.rating} trên 5 sao`}>
                ★ {review.rating}/5
              </strong>
            </div>
            <small className="muted">
              {formatTime(review.createdAt)}
              {review.verifiedPurchase && " · Đã mua tài liệu"}
            </small>
            <p className="learner-prose">
              {review.comment || "Không có nhận xét bằng chữ."}
            </p>
            {review.reviewer.userId !== actor.userId && (
              <button
                type="button"
                className="btn"
                onClick={() => setReporting(review)}
              >
                Báo cáo đánh giá
              </button>
            )}
          </article>
        ))}
      </div>
      {!list.loading && !list.error && !list.items.length && (
        <p className="muted">
          Chưa có đánh giá công khai. Chia sẻ trải nghiệm của bạn sau khi sử
          dụng tài liệu.
        </p>
      )}
      <ListPagination query={list} />
      {reporting && (
        <ReviewReport
          key={reporting.id}
          review={reporting}
          onClose={() => setReporting(undefined)}
        />
      )}
    </Panel>
  );
}
function ReviewEditor({
  materialId,
  own,
  onSaved,
  onCancel,
}: Readonly<{
  materialId: string;
  own?: OwnReview | null;
  onSaved: () => void;
  onCancel?: () => void;
}>) {
  const { request } = useUserSession();
  const command = useUserCommand(!own);
  const [rating, setRating] = useState(own?.rating ?? 5);
  const [comment, setComment] = useState(own?.comment ?? "");
  let submitLabel = own ? "Lưu đánh giá" : "Gửi đánh giá";
  if (command.pending) submitLabel = "Đang gửi…";
  else if (command.canRetry) submitLabel = "Kiểm tra và gửi lại đánh giá";
  return (
    <form
      className={`learner-form ${styles.own}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const body = {
          rating,
          comment: comment.trim(),
          ...(own ? { expectedVersion: own.version } : {}),
        };
        const result = await command.run(JSON.stringify(body), async (key) => {
          const fresh = await request<Eligibility>(
            `materials/${materialId}/review-eligibility`,
          );
          if (
            own &&
            (!fresh.data.canEdit ||
              fresh.data.currentReview?.id !== own.id ||
              fresh.data.currentReview.version !== own.version)
          )
            throw new UserApiError(409, "MATERIAL_REVIEW_EDIT_BLOCKED");
          if (!own && !fresh.data.canReview)
            throw new UserApiError(409, "MATERIAL_REVIEW_EDIT_BLOCKED");
          return request(
            own
              ? `material-reviews/${own.id}`
              : `materials/${materialId}/reviews`,
            { method: own ? "PATCH" : "POST", body, ...(!own ? { key } : {}) },
          );
        });
        if (result) onSaved();
      }}
    >
      <fieldset
        className={styles.stars}
        disabled={command.pending || command.uncertain}
      >
        <legend>Bạn thấy tài liệu này thế nào?</legend>
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star}>
            <input
              type="radio"
              name="rating"
              value={star}
              checked={rating === star}
              onChange={() => setRating(star)}
            />
            <span>{star} ★</span>
          </label>
        ))}
      </fieldset>
      <label>
        <span>Chia sẻ trải nghiệm (không bắt buộc)</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={command.pending || command.uncertain}
          placeholder="Nội dung hữu ích thế nào với bạn?"
        />
      </label>
      <CommandFeedback command={command} />
      <div className={styles.row}>
        <LoadingButton
          type="submit"
          className="btn btn-primary"
          disabled={command.pending || (command.uncertain && !command.canRetry)}
          loading={!!command.pending}
        >
          {submitLabel}
        </LoadingButton>
        {onCancel && (
          <LoadingButton
            type="button"
            className="btn"
            disabled={command.pending}
            onClick={onCancel}
            loading={!!command.pending}
          >
            Hủy
          </LoadingButton>
        )}
      </div>
      {(command.failure || command.uncertain) && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={command.pending}
          onClick={async () => {
            await request(`materials/${materialId}/review-eligibility`)
              .then(onSaved)
              .catch(() => undefined);
          }}
          loading={!!command.pending}
        >
          Tải lại đánh giá của tôi
        </LoadingButton>
      )}
    </form>
  );
}
function RemoveReview({
  review,
  onRemoved,
}: Readonly<{ review: OwnReview; onRemoved: () => void }>) {
  const { request } = useUserSession();
  const command = useUserCommand(true);
  return (
    <details className={styles.distribution}>
      <summary>Xóa đánh giá</summary>
      <p>Đánh giá sẽ không còn xuất hiện công khai.</p>
      <CommandFeedback command={command} />
      <LoadingButton
        type="button"
        className="btn"
        disabled={command.pending || (command.uncertain && !command.canRetry)}
        onClick={async () => {
          const result = await command.run(
            `delete:${review.id}:${review.version}`,
            () =>
              request(
                `material-reviews/${review.id}?expectedVersion=${review.version}`,
                { method: "DELETE" },
              ),
          );
          if (result) onRemoved();
        }}
        loading={!!command.pending}
      >
        Xác nhận xóa
      </LoadingButton>
      {(command.failure || command.uncertain) && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={command.pending}
          onClick={onRemoved}
          loading={!!command.pending}
        >
          Kiểm tra lại đánh giá
        </LoadingButton>
      )}
    </details>
  );
}
function ReviewReport({
  review,
  onClose,
}: Readonly<{ review: Review; onClose: () => void }>) {
  const { request } = useUserSession();
  const command = useUserCommand();
  const [sent, setSent] = useState(false);
  return (
    <section className={styles.own} aria-label="Báo cáo đánh giá">
      <h3>Báo cáo đánh giá của {review.reviewer.fullName}</h3>
      {sent ? (
        <p>
          <output>Đã gửi báo cáo. Nhân sự sẽ xem xét nội dung này.</output>
        </p>
      ) : (
        <form
          className="learner-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const body = {
              reasonCode: formText(fields, "reasonCode"),
              description: formText(fields, "description").trim(),
            };
            const result = await command.run(JSON.stringify(body), () =>
              request(`material-reviews/${review.id}/reports`, {
                method: "POST",
                body,
              }),
            );
            if (result) setSent(true);
          }}
        >
          <label>
            <span>Lý do</span>
            <select name="reasonCode">
              {reportReasons.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Nội dung cần xem xét</span>
            <textarea
              name="description"
              minLength={10}
              maxLength={2000}
              required
              rows={3}
            />
          </label>
          <CommandFeedback command={command} />
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            disabled={command.pending || command.uncertain}
            loading={!!command.pending}
          >
            Gửi báo cáo
          </LoadingButton>
        </form>
      )}
      <LoadingButton
        type="button"
        className="btn"
        onClick={onClose}
        disabled={command.pending}
        loading={!!command.pending}
      >
        Đóng
      </LoadingButton>
    </section>
  );
}
