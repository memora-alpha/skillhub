"use client";
import { systemCodeLabel } from "@/lib/system-text";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { ReputationPathSource } from "./reputation-path-source";
import { ReputationRecovery } from "./reputation-recovery";
import { useListPages } from "@/components/pagination/use-list-pages";
import { ListPagination } from "@/components/pagination/list-pagination";
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
  const current = query.data?.pages[0];
  const denied =
    !!query.error &&
    "status" in query.error &&
    [401, 403, 404].includes(Number(query.error.status));
  const pagination = useListPages({
    scope: `${actor.userId}:reputation`,
    chunks: denied ? [] : (query.data?.pages.map((page) => page.items) ?? []),
    loading: query.isFetching,
    hasMore: !!query.hasNextPage && !denied,
    error: query.error?.message,
    more: () => query.fetchNextPage({ cancelRefetch: false }),
    reload: () => query.refetch(),
  });
  const entries = pagination.items;
  return (
    <>
      <Back href="/learn/profile" />
      <PageHeading
        eyebrow="Thang điểm 0–100 · Khởi điểm 50"
        title="Uy tín & phục hồi"
        description="Điểm uy tín phản ánh mức độ đáng tin cậy của bạn qua từng lộ trình hoàn tất, đánh giá 1–5 sao và tuân thủ lịch học."
      />
      <Feedback
        loading={query.isPending}
        error={query.error?.message}
        reload={() => void pagination.reload()}
        refreshing={!!(query.isFetching && !query.isPending)}
      />
      {!denied && current && (
        <div className="reputation-hero">
          <Panel title="Điểm uy tín hiện tại">
            <div
              className="reputation-score-display"
              data-low={current.reputationScore < 40}
            >
              <strong>{current.reputationScore}</strong>
              <span>/ 100 điểm</span>
            </div>
            <div className="reputation-meter" aria-hidden="true">
              <div
                className="reputation-meter-fill"
                data-low={current.reputationScore < 40}
                style={{
                  width: `${Math.min(100, Math.max(0, current.reputationScore))}%`,
                }}
              />
            </div>
            <div className="reputation-bands">
              <span>0</span>
              <span>40 Cảnh báo</span>
              <span>50 Khởi điểm</span>
              <span>80 Rất tốt</span>
              <span>100</span>
            </div>
            <p style={{ marginTop: 14 }}>
              Xếp hạng hiện tại:{" "}
              <strong>{levels[current.level] ?? "Chưa xác định"}</strong>
            </p>
          </Panel>
          <Panel title="Hạn chế đang áp dụng">
            {current.activeRestrictions.length ? (
              <div className="learner-stack">
                {current.activeRestrictions.map((restriction) => (
                  <div
                    className="learner-notice"
                    key={`${restriction.scope}:${restriction.reasonCode}:${restriction.endsAt}`}
                  >
                    <strong>
                      {scopes[restriction.scope] ??
                        systemCodeLabel(restriction.scope)}
                    </strong>
                    <p>
                      Lý do:{" "}
                      {reasons[restriction.reasonCode] ??
                        systemCodeLabel(restriction.reasonCode)}
                    </p>
                    <p>
                      Hết hạn: <strong>{formatTime(restriction.endsAt)}</strong>
                      . Bạn vẫn có thể xem lịch và học các buổi đã chốt.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p>
                Tài khoản không có hạn chế nào. Bạn có đầy đủ quyền tạo nhu cầu
                học, gửi đề nghị và tham gia thỏa thuận mới.
              </p>
            )}
          </Panel>
        </div>
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
      {!denied && <ListPagination query={pagination} />}
    </>
  );
}
