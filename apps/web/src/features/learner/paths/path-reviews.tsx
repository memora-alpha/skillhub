"use client";
import { useState } from "react";
import type { LearningPath } from "../types";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Feedback,
  Panel,
  formatTime,
} from "../components/common";
import { checkedReviews, type PathReview } from "./post-session-contract";
import { UserApiError } from "../api/client";

export function PathReviews({ path }: Readonly<{ path: LearningPath }>) {
  const { actor, request } = useUserSession();
  const query = useUserResource<PathReview[]>(
    "learning-paths/" + path.id + "/reviews",
  );
  const command = useUserCommand();
  const [checking, setChecking] = useState(false);
  const [readError, setReadError] = useState<string>();
  const [rating, setRating] = useState(0),
    [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  let rows: PathReview[] | undefined;
  let contractError: string | undefined;
  if (query.data) {
    try {
      rows = checkedReviews(query.data, path.id, [
        path.participantAId,
        path.participantBId,
      ]);
    } catch {
      contractError =
        "Phản hồi đánh giá chưa hợp lệ. Tải lại trước khi gửi đánh giá.";
    }
  }
  const own = rows?.find((r) => r.reviewerId === actor.userId);
  const opened = path.status === "COMPLETED" && !!path.settledAt;
  async function reconcile() {
    if (checking || command.pending) return;
    setChecking(true);
    setReadError(undefined);
    try {
      const latest = checkedReviews(
        (await request("learning-paths/" + path.id + "/reviews")).data,
        path.id,
        [path.participantAId, path.participantBId],
      );
      if (latest.some((row) => row.reviewerId === actor.userId))
        setSubmitted(true);
      // The server's unique path/reviewer constraint also protects a later resubmission.
      command.resetAfterRead();
      query.reload();
    } catch (cause) {
      setReadError(
        cause instanceof Error
          ? cause.message
          : "Chưa kiểm tra được kết quả. Vui lòng thử lại.",
      );
    } finally {
      setChecking(false);
    }
  }
  async function submit() {
    const body = { rating, comment: comment.trim() };
    const result = await command.run(
      JSON.stringify({ pathId: path.id, body }),
      async () => {
        const latest = checkedReviews(
          (await request("learning-paths/" + path.id + "/reviews")).data,
          path.id,
          [path.participantAId, path.participantBId],
        );
        if (latest.some((r) => r.reviewerId === actor.userId))
          throw new UserApiError(409, "REVIEW_ALREADY_SUBMITTED");
        return request<PathReview>("learning-paths/" + path.id + "/reviews", {
          method: "POST",
          body,
        });
      },
    );
    if (result) setSubmitted(true);
    query.reload();
  }
  return (
    <Panel title="Đánh giá sau lộ trình">
      <Feedback
        loading={query.loading}
        error={readError ?? query.error ?? contractError}
        reload={() => void reconcile()}
      />
      {rows?.map((r) => (
        <article key={r.id}>
          <h3>
            {r.reviewerId === actor.userId
              ? "Đánh giá bạn đã gửi"
              : "Đánh giá từ đối tác"}{" "}
            · {r.rating}/5
          </h3>
          <p className="learner-prose">
            {r.comment || "Không có nhận xét thêm."}
          </p>
          <small>{formatTime(r.createdAt)}</small>
        </article>
      ))}
      {!opened && <p className="muted">Mở đánh giá sau khi quyết toán.</p>}
      {own ||
      submitted ||
      command.failure?.code === "REVIEW_ALREADY_SUBMITTED" ? (
        <p>
          <output>Bạn đã gửi đánh giá cho lộ trình này.</output>
        </p>
      ) : (
        opened && (
          <form
            className="learner-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label>
              <span>Chấm điểm đối tác</span>
              <select
                required
                value={rating}
                disabled={checking || command.pending || command.uncertain}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                <option value={0} disabled>
                  Chọn số sao
                </option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} sao
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nhận xét (không bắt buộc)</span>
              <textarea
                value={comment}
                maxLength={1000}
                disabled={checking || command.pending || command.uncertain}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                rating < 1 ||
                checking ||
                command.pending ||
                command.uncertain ||
                query.loading ||
                !!query.error ||
                !!contractError ||
                !rows
              }
            >
              Gửi đánh giá
            </button>
          </form>
        )
      )}
      {!own && !submitted && <CommandFeedback command={command} />}
      {command.uncertain && !own && !submitted && (
        <button
          type="button"
          className="btn"
          disabled={checking || command.pending}
          onClick={() => void reconcile()}
        >
          {checking ? "Đang kiểm tra…" : "Kiểm tra lại kết quả"}
        </button>
      )}
      {command.uncertain && !own && !submitted && (
        <p>
          Chưa rõ kết quả. Tải lại danh sách trước khi thao tác tiếp; không tự
          gửi trùng đánh giá.
        </p>
      )}
    </Panel>
  );
}
