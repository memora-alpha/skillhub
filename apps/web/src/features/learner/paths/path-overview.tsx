"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import {
  Feedback,
  More,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { settlementStatusLabels } from "./post-session-contract";
import { PrivateCaseThread } from "../account/private-case-thread";
type Target = { type: string; id: string };
type Attention = {
  key: string;
  type: string;
  status: string;
  waitingOn: string;
  deadline: string | null;
  target: Target;
  blocksSettlement: boolean;
};
export type PathOverview = {
  learningStage: string | null;
  progress: {
    learning: { completed: number; total: number } | null;
    teaching: { completed: number; total: number } | null;
  };
  nextSession: { id: string; startAt: string; role: string } | null;
  attentionCount: number;
  attentionItems?: Attention[];
  settlement: {
    status: string;
    reasonCode: string | null;
    autoSettlementAt: string | null;
  };
};
const stages: Record<string, string> = {
  PREPARING: "Đang chuẩn bị",
  WAITING_START: "Chờ bắt đầu",
  LEARNING: "Đang học",
  LEARNING_FINISHED: "Đã học xong",
  COMPLETED: "Đã hoàn tất",
  STOPPED: "Đã dừng",
};
const settlementReasons: Record<string, string> = {
  SETTLEMENT_BLOCKED_BY_TERMINATION: "Cần xử lý yêu cầu dừng lộ trình trước.",
  SETTLEMENT_BLOCKED_BY_DISPUTE: "Cần giải quyết vụ việc còn mở trước.",
  PATH_SESSIONS_INCOMPLETE:
    "Một số buổi học chưa hoàn tất hoặc còn chờ xác nhận.",
  DISPUTE_WINDOW_OPEN: "Đang giữ Credit trong thời hạn khiếu nại.",
  LEARNING_PATH_NOT_SETTLEABLE: "Nhân sự cần kiểm tra điều kiện quyết toán.",
};
export function PathProgress({
  overview,
}: Readonly<{ overview: PathOverview }>) {
  return (
    <div className="learner-stack">
      <strong>
        {stages[overview.learningStage ?? ""] ?? "Đang cập nhật tiến độ"}
      </strong>
      <div className="learner-actions">
        {(
          [
            ["learning", "Bạn học"],
            ["teaching", "Bạn hướng dẫn"],
          ] as const
        ).map(([key, label]) => {
          const row = overview.progress[key];
          return row ? (
            <span key={key}>
              {label}:{" "}
              <strong>
                {row.completed}/{row.total} buổi
              </strong>
            </span>
          ) : null;
        })}
      </div>
      {overview.nextSession && (
        <Link href={"/learn/sessions/" + overview.nextSession.id}>
          Buổi tiếp theo: {formatTime(overview.nextSession.startAt)}
        </Link>
      )}
      {overview.attentionCount > 0 && (
        <p>{overview.attentionCount} việc cần theo dõi</p>
      )}
    </div>
  );
}
type CaseSummary = {
  id: string;
  status: string;
  reasonCode: string;
  relatedSessionId: string | null;
  blocksSettlement: boolean;
  createdAt: string | null;
};
export function PathOverviewPanel({ pathId }: Readonly<{ pathId: string }>) {
  const query = useUserResource<PathOverview>(
    `learning-paths/${pathId}/overview`,
  );
  const cases = useUserList<CaseSummary>(
    `learning-paths/${pathId}/cases?limit=20`,
  );
  const [selected, setSelected] = useState<string>();
  const summary = useUserResource<CaseSummary>(
    selected ? `learning-paths/${pathId}/cases/${selected}/summary` : null,
  );
  return (
    <Panel title="Tiến độ và việc cần làm">
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.data && (
        <>
          <PathProgress overview={query.data} />
          <p>
            {settlementStatusLabels[query.data.settlement.status] ??
              "Đang cập nhật quyết toán"}
          </p>
          {query.data.settlement.reasonCode && (
            <p className="muted">
              {settlementReasons[query.data.settlement.reasonCode] ??
                "Cần kiểm tra điều kiện quyết toán trong phần thỏa thuận."}
            </p>
          )}
          {query.data.settlement.autoSettlementAt && (
            <p className="muted">
              Dự kiến quyết toán:{" "}
              {formatTime(query.data.settlement.autoSettlementAt)}
            </p>
          )}
          {query.data.attentionItems?.map((item) => (
            <div key={item.key}>
              <Status value={item.status} />
              <span>
                {" "}
                ·{" "}
                {item.waitingOn === "SELF"
                  ? "Cần bạn xử lý"
                  : item.waitingOn === "COUNTERPART"
                    ? "Chờ đối tác"
                    : item.waitingOn === "STAFF"
                      ? "Chờ nhân sự hỗ trợ"
                      : "Đang theo dõi"}
              </span>
              {item.deadline && <p>Hạn: {formatTime(item.deadline)}</p>}
              {item.target.type === "SESSION" && (
                <Link href={"/learn/sessions/" + item.target.id}>
                  Xem buổi học
                </Link>
              )}
              {item.target.type === "CASE_SUMMARY" && (
                <button
                  className="btn"
                  onClick={() => setSelected(item.target.id)}
                >
                  Xem vụ việc
                </button>
              )}
            </div>
          ))}
        </>
      )}
      <details>
        <summary>
          Vụ việc trong lộ trình ({cases.items.length}
          {cases.cursor ? "+" : ""})
        </summary>
        <Feedback
          loading={cases.loading}
          error={cases.error}
          reload={cases.reload}
        />
        {cases.items.map((item) => (
          <p key={item.id}>
            <Status value={item.status} />{" "}
            <button className="btn" onClick={() => setSelected(item.id)}>
              Xem vụ việc {item.id.slice(0, 8)}
            </button>
            {item.blocksSettlement && <span> · Đang chặn quyết toán</span>}
          </p>
        ))}
        {!cases.loading && !cases.items.length && <p>Không có vụ việc.</p>}
        <More
          cursor={cases.cursor}
          loading={cases.loading}
          onMore={() => {
            void cases.more();
          }}
        />
      </details>
      {selected && (
        <section>
          <button className="btn" onClick={() => setSelected(undefined)}>
            Đóng vụ việc
          </button>
          <Feedback
            loading={summary.loading}
            error={summary.error}
            reload={summary.reload}
          />
          {summary.data && (
            <>
              <Status value={summary.data.status} />
              <PrivateCaseThread
                caseId={selected}
                closed={["RESOLVED", "REJECTED"].includes(summary.data.status)}
              />
            </>
          )}
        </section>
      )}
    </Panel>
  );
}
