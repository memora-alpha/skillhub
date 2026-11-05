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
        error={query.error ?? contractError}
        reload={query.reload}
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
      {!opened && (
        <p>
          Đánh giá mở sau khi toàn bộ lộ trình hoàn thành và BE đã quyết toán.
          Việc chỉ hoàn thành một buổi chưa mở đánh giá.
        </p>
      )}
      {own ||
      submitted ||
      command.failure?.code === "REVIEW_ALREADY_SUBMITTED" ? (
        <p role="status">Bạn đã gửi đánh giá cho lộ trình này.</p>
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
                disabled={command.pending || command.uncertain}
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
                disabled={command.pending || command.uncertain}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <p>
              Mỗi người gửi một đánh giá cho đối tác trên mỗi lộ trình. Điểm uy
              tín do máy chủ cập nhật theo đánh giá.
            </p>
            <button
              className="btn btn-primary"
              disabled={
                rating < 1 ||
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
        <p>
          Chưa rõ kết quả. Tải lại danh sách trước khi thao tác tiếp; không tự
          gửi trùng đánh giá.
        </p>
      )}
    </Panel>
  );
}
