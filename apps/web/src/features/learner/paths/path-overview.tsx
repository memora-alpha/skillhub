"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback, Status, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { settlementStatusLabels } from "./post-session-contract";
import { PathCases } from "./path-cases";
import { learningStageLabel } from "./path-navigation";
import styles from "./path-detail.module.css";

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

function percent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function waitingLabel(waitingOn: string) {
  if (waitingOn === "SELF") return "Cần bạn xử lý";
  if (waitingOn === "COUNTERPART") return "Chờ đối tác";
  if (waitingOn === "STAFF") return "Chờ nhân sự hỗ trợ";
  return "Đang theo dõi";
}

function settlementStateClass(status: string) {
  if (status === "SETTLED") return ` ${styles.settlementStateOk}`;
  if (
    ["WAITING_DISPUTE", "WAITING_TERMINATION", "NEEDS_REVIEW"].includes(status)
  )
    return ` ${styles.settlementStateWarn}`;
  return "";
}

export function PathProgress({
  overview,
}: Readonly<{ overview: PathOverview }>) {
  const stageText =
    learningStageLabel(overview.learningStage) ??
    stages[overview.learningStage ?? ""] ??
    "Đang cập nhật tiến độ";
  const rows = (
    [
      ["learning", "Bạn học", styles.progressFillLearn],
      ["teaching", "Bạn hướng dẫn", styles.progressFillTeach],
    ] as const
  )
    .map(([key, label, fillClass]) => ({
      key,
      label,
      fillClass,
      data: overview.progress[key],
    }))
    .filter((entry) => entry.data !== null);

  return (
    <div className={styles.progressList}>
      <span className={styles.stageLine}>
        <ProductIcon name="book" size={14} />
        {stageText}
      </span>

      {rows.length > 0 ? (
        rows.map(({ key, label, fillClass, data }) => {
          const pct = percent(data!.completed, data!.total);
          return (
            <div key={key} className={styles.progressRow}>
              <div className={styles.progressTop}>
                <span>{label}</span>
                <strong>
                  {data!.completed}/{data!.total} buổi
                  <span className={styles.progressPercent}>({pct}%)</span>
                </strong>
              </div>
              <div className={styles.progressTrack} aria-hidden="true">
                <span className={fillClass} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })
      ) : (
        <p className={styles.metaNote}>
          Tiến độ buổi học sẽ hiển thị sau khi hai bên hoàn tất thiết lập và
          chốt lịch.
        </p>
      )}

      {overview.nextSession && (
        <Link
          href={`/learn/sessions/${overview.nextSession.id}`}
          className={styles.nextSessionBanner}
        >
          <span className={styles.nextSessionInfo}>
            <ProductIcon name="calendar" size={18} />
            <span>
              <small>Buổi học tiếp theo</small>
              <strong>{formatTime(overview.nextSession.startAt)}</strong>
            </span>
          </span>
          <ProductIcon name="arrow" size={16} />
        </Link>
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
  const data = query.data;
  const attentionItems = data?.attentionItems ?? [];

  function renderAttentionAction(item: Attention) {
    if (item.target.type === "SESSION") {
      return (
        <Link
          className="btn btn-sm btn-primary"
          href={`/learn/sessions/${item.target.id}`}
        >
          Xem buổi học
          <ProductIcon name="arrow" size={14} />
        </Link>
      );
    }
    if (item.target.type === "CASE_SUMMARY") {
      return (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setSelected(item.target.id)}
        >
          Xem vụ việc
        </button>
      );
    }
    if (item.target.type === "LEARNING_CHANGE") {
      if (item.sessionId) {
        return (
          <Link
            className="btn btn-sm btn-primary"
            href={`/learn/sessions/${item.sessionId}`}
          >
            Xem yêu cầu đổi buổi
          </Link>
        );
      }
      if (onOpenSection) {
        return (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onOpenSection("path-changes")}
          >
            Xem yêu cầu dừng lộ trình
          </button>
        );
      }
      return (
        <Link
          className="btn btn-sm btn-primary"
          href={`/learn/paths/${pathId}#path-changes`}
        >
          Xem yêu cầu dừng lộ trình
        </Link>
      );
    }
    return null;
  }

  return (
    <section
      className={styles.overviewWrap}
      aria-label="Tiến độ và việc cần làm"
    >
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />

      {attentionItems.length > 0 && (
        <div className={styles.attentionCard}>
          <div className={styles.attentionHead}>
            <ProductIcon name="notification" size={18} />
            <h2>Cần theo dõi ({attentionItems.length})</h2>
          </div>
          <div className={styles.attentionList}>
            {attentionItems.map((item) => (
              <div key={item.key} className={styles.attentionItem}>
                <div className={styles.attentionBody}>
                  <div className={styles.attentionMeta}>
                    <Status value={item.status} />
                    <span>{waitingLabel(item.waitingOn)}</span>
                  </div>
                  {item.deadline && (
                    <span className={styles.attentionDeadline}>
                      <ProductIcon name="clock" size={13} />
                      Hạn xử lý: {formatTime(item.deadline)}
                    </span>
                  )}
                </div>
                {renderAttentionAction(item)}
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className={styles.overviewGrid}>
          <div className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={styles.cardIcon}>
                  <ProductIcon name="book" size={18} />
                </span>
                <div>
                  <h2>Tiến độ học tập</h2>
                  <p>Cập nhật theo kết quả hoàn thành từng buổi</p>
                </div>
              </div>
            </div>
            <PathProgress overview={data} />
          </div>

          <div className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={`${styles.cardIcon} ${styles.cardIconSage}`}>
                  <ProductIcon name="wallet" size={18} />
                </span>
                <div>
                  <h2>Quyết toán &amp; Hỗ trợ</h2>
                  <p>Trạng thái giữ Credit và các vụ việc liên quan</p>
                </div>
              </div>
            </div>

            <div className={styles.settlementBadgeRow}>
              <span
                className={
                  styles.settlementState +
                  settlementStateClass(data.settlement.status)
                }
              >
                {settlementStatusLabels[data.settlement.status] ??
                  "Đang cập nhật quyết toán"}
              </span>
            </div>

            {data.settlement.reasonCode && (
              <p className={styles.metaNote}>
                {settlementReasons[data.settlement.reasonCode] ??
                  "Cần kiểm tra điều kiện quyết toán trong phần thỏa thuận."}
              </p>
            )}

            {data.settlement.autoSettlementAt && (
              <p className={styles.metaNote}>
                Dự kiến quyết toán:{" "}
                <strong>{formatTime(data.settlement.autoSettlementAt)}</strong>
              </p>
            )}

            {onOpenSection && data.learningStage === "LEARNING_FINISHED" && (
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onOpenSection("path-settlement")}
                >
                  Theo dõi quyết toán
                  <ProductIcon name="arrow" size={14} />
                </button>
              </div>
            )}

            {onOpenSection && data.learningStage === "COMPLETED" && (
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onOpenSection("path-settlement")}
                >
                  Xem kết quả &amp; đánh giá
                  <ProductIcon name="arrow" size={14} />
                </button>
              </div>
            )}

            <div className={styles.casesDisclosure}>
              <PathCases
                compact
                pathId={pathId}
                selected={selected}
                onSelect={setSelected}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
