"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback, Panel, Status, formatTime } from "../components/common";
import { settlementStatusLabels } from "./post-session-contract";
import { PathCases } from "./path-cases";
import styles from "../components/learning-layout.module.css";
import { learningStageLabel } from "./path-navigation";
type Target = { type: string; id: string };
type Attention = {
  key: string;
  type: string;
  status: string;
  waitingOn: string;
  deadline: string | null;
  target: Target;
  sessionId?: string | null;
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
        {learningStageLabel(overview.learningStage) ??
          stages[overview.learningStage ?? ""] ??
          "Đang cập nhật tiến độ"}
      </strong>
      <div className={styles.progressList}>
        {(
          [
            ["learning", "Bạn học"],
            ["teaching", "Bạn hướng dẫn"],
          ] as const
        ).map(([key, label]) => {
          const row = overview.progress[key];
          return row ? (
            <div key={key} className={styles.progressRow}>
              <span>{label}</span>
              <strong>
                {row.completed}/{row.total} buổi
              </strong>
              <progress
                aria-label={label}
                value={row.completed}
                max={Math.max(row.total, 1)}
              />
            </div>
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
export function PathOverviewPanel({
  pathId,
  onOpenSection,
}: Readonly<{ pathId: string; onOpenSection?: (section: string) => void }>) {
  const query = useUserResource<PathOverview>(
    `learning-paths/${pathId}/overview`,
  );
  const [selected, setSelected] = useState<string>();
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
          {onOpenSection &&
            query.data.learningStage === "LEARNING_FINISHED" && (
              <button
                className="btn btn-primary"
                onClick={() => onOpenSection("path-settlement")}
              >
                Theo dõi quyết toán
              </button>
            )}
          {onOpenSection && query.data.learningStage === "COMPLETED" && (
            <button
              className="btn btn-primary"
              onClick={() => onOpenSection("path-settlement")}
            >
              Xem kết quả & đánh giá
            </button>
          )}
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
              {item.target.type === "LEARNING_CHANGE" &&
                (item.sessionId ? (
                  <Link href={`/learn/sessions/${item.sessionId}`}>
                    Xem yêu cầu thay đổi buổi học
                  </Link>
                ) : onOpenSection ? (
                  <button
                    className="btn"
                    onClick={() => onOpenSection("path-changes")}
                  >
                    Xem yêu cầu dừng lộ trình
                  </button>
                ) : (
                  <Link href={`/learn/paths/${pathId}#path-changes`}>
                    Xem yêu cầu dừng lộ trình
                  </Link>
                ))}
            </div>
          ))}
        </>
      )}
      <PathCases
        compact
        pathId={pathId}
        selected={selected}
        onSelect={setSelected}
      />
    </Panel>
  );
}
