"use client";
import { systemCodeLabel } from "@/lib/system-text";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { ReputationPathSource } from "./reputation-path-source";
import { ReputationRecovery } from "./reputation-recovery";
import {
  Back,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
type Entry = {
  id: string;
  delta: number;
  scoreBefore: number;
  scoreAfter: number;
  reasonCode: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};
type History = {
  reputationScore: number;
  level: string;
  activeRestrictions: { scope: string; reasonCode: string; endsAt: string }[];
  items: Entry[];
  nextCursor: string | null;
};
const reasons: Record<string, string> = {
  REVIEW_RATING: "Đánh giá từ đối tác",
  SESSION_NO_SHOW: "Vắng buổi học",
  NO_SHOW: "Vắng buổi học",
  REPORT_RESOLUTION: "Quyết định xử lý báo cáo",
  SESSION_COMPLETED: "Hoàn thành buổi học",
  PATH_COMPLETED: "Hoàn thành lộ trình",
  ADJUDICATED_VIOLATION: "Vi phạm theo quyết định xử lý",
  LOW_REPUTATION: "Điểm uy tín thấp",
};
const levels: Record<string, string> = {
  EXCELLENT: "Rất tốt",
  NORMAL: "Bình thường",
  WARNING: "Cảnh báo",
  RESTRICTED: "Bị hạn chế",
  LOW: "Thấp",
  SEVERE: "Nghiêm trọng",
  CRITICAL: "Rất nghiêm trọng",
};
const scopes: Record<string, string> = {
  CREATE_NEW_ACTIVITY: "Hạn chế tạo hoạt động mới",
  REQUIRE_STAFF_REVIEW: "Cần Staff xem xét",
  REQUIRE_ADMIN_REVIEW: "Cần Admin xem xét",
};
export function ReputationScreen() {
  const { request, actor } = useUserSession();
  const query = useInfiniteQuery({
    queryKey: ["learner", actor.userId, "reputation/me"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const data = (
        await request<History>(
          "reputation/me" +
            (pageParam ? "?cursor=" + encodeURIComponent(pageParam) : ""),
          { signal },
        )
      ).data;
      if (
        !Array.isArray(data.items) ||
        !Array.isArray(data.activeRestrictions) ||
        typeof data.reputationScore !== "number" ||
        (data.nextCursor !== null && typeof data.nextCursor !== "string") ||
        (pageParam && data.nextCursor === pageParam)
      )
        throw new Error("Dữ liệu lịch sử chưa hợp lệ. Vui lòng tải lại.");
      return data;
    },
    getNextPageParam: (page, _pages, _param, params) =>
      page.nextCursor && !params.includes(page.nextCursor)
        ? page.nextCursor
        : undefined,
  });
  const current = query.data?.pages[0],
    entries = [
      ...new Map(
        query.data?.pages
          .flatMap((page) => page.items)
          .map((entry) => [entry.id, entry]) ?? [],
      ).values(),
    ];
  const denied =
    !!query.error &&
    "status" in query.error &&
    [401, 403, 404].includes(Number(query.error.status));
  return (
    <>
      <Back href="/learn/profile" />
      <PageHeading
        title="Uy tín của bạn"
        description="Theo dõi sự tin cậy bạn xây dựng qua mỗi lần học cùng nhau."
      />
      <Feedback
        loading={query.isFetching}
        error={query.error?.message}
        reload={() => void query.refetch()}
      />
      {!denied && current && (
        <>
          <Panel title="Uy tín hiện tại">
            <strong className="product-price">{current.reputationScore}</strong>
            <p>Cấp độ: {levels[current.level] ?? "Chưa xác định"}</p>
          </Panel>
          <Panel title="Hạn chế đang áp dụng">
            {current.activeRestrictions.length ? (
              current.activeRestrictions.map((restriction, index) => (
                <p key={restriction.scope + index}>
                  {scopes[restriction.scope] ??
                    systemCodeLabel(restriction.scope)}{" "}
                  ·{" "}
                  {reasons[restriction.reasonCode] ??
                    systemCodeLabel(restriction.reasonCode)}{" "}
                  · thời hạn đến {formatTime(restriction.endsAt)}. Có thể cần
                  xác nhận chính sách hoặc xét lại để mở quyền.
                </p>
              ))
            ) : (
              <p>Không có hạn chế đang áp dụng.</p>
            )}
          </Panel>
        </>
      )}
      {!denied &&
        current &&
        (current.reputationScore < 40 ||
          current.activeRestrictions.length > 0) && (
          <ReputationRecovery onChanged={() => void query.refetch()} />
        )}
      <div className="learner-stack">
        {!denied && entries.length > 0 && <h2>Lịch sử thay đổi</h2>}
        {!denied &&
          entries.map((entry) => (
            <Panel
              key={entry.id}
              title={
                reasons[entry.reasonCode] ?? systemCodeLabel(entry.reasonCode)
              }
            >
              <strong>
                {entry.delta > 0 ? "+" : ""}
                {entry.delta} điểm
              </strong>
              <p>
                {entry.scoreBefore} → {entry.scoreAfter} ·{" "}
                {formatTime(entry.createdAt)}
              </p>
              {entry.sourceType === "LEARNING_PATH" ? (
                <ReputationPathSource
                  key={entry.sourceId}
                  pathId={entry.sourceId}
                />
              ) : (
                <details>
                  <summary>Thông tin tham chiếu</summary>
                  <p className="learner-prose">
                    {systemCodeLabel(entry.sourceType, "Hoạt động liên quan")}:{" "}
                    {entry.sourceId}
                  </p>
                </details>
              )}
            </Panel>
          ))}
      </div>
      {!query.isPending && !query.error && !entries.length && (
        <Empty>Chưa có biến động uy tín.</Empty>
      )}
      {query.hasNextPage && !denied && (
        <button
          className="btn"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          Xem lịch sử cũ hơn
        </button>
      )}
    </>
  );
}
