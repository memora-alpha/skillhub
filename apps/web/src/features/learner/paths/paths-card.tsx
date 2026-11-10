import Link from "next/link";
import { Status, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { learningStageLabel, pathActionLabel } from "./path-navigation";
import type { PathListItem } from "./paths-list-model";
import styles from "./paths-screen.module.css";

const exchangeLabels: Record<string, string> = {
  TWO_WAY: "Trao đổi kỹ năng hai chiều",
  ONE_WAY: "Hướng dẫn một chiều",
};

export function PathCard({
  path,
  counterpartName,
}: Readonly<{ path: PathListItem; counterpartName?: string }>) {
  const stageLabel = learningStageLabel(path.learningStage);
  const planning = path.learningStage === "PREPARING";
  return (
    <article className={`learner-card panel ${styles.card}`}>
      <div className={styles.top}>
        <Status value={path.status} label={stageLabel} />
        <span className={styles.exchange}>
          {exchangeLabels[path.exchangeType ?? ""] ??
            "Đang thống nhất hình thức"}
        </span>
      </div>
      <div className={styles.heading}>
        <h2>{path.title || `Lộ trình cùng ${counterpartName || "đối tác"}`}</h2>
        <p className="muted">Học cùng {counterpartName || "đối tác"}</p>
      </div>
      <div className={styles.progressGroup}>
        {(
          [
            ["learning", "Bạn học"],
            ["teaching", "Bạn hướng dẫn"],
          ] as const
        ).map(([key, label]) => {
          const progress = path.progress?.[key];
          return progress ? (
            <div key={key} className={styles.progressRow}>
              <div className={styles.progressMeta}>
                <strong>{label}</strong>
                {progress.total > 0 && (
                  <span>
                    {progress.completed}/{progress.total} buổi
                  </span>
                )}
              </div>
              {progress.total > 0 ? (
                <progress
                  aria-label={`${label}: ${progress.completed} trên ${progress.total} buổi`}
                  value={progress.completed}
                  max={progress.total}
                />
              ) : (
                <span className="muted">
                  {planning ? "Đang thống nhất kế hoạch" : "Chưa có buổi học"}
                </span>
              )}
            </div>
          ) : null;
        })}
        {!path.progress?.learning && !path.progress?.teaching && (
          <p className="muted">
            {planning
              ? "Đang thống nhất kế hoạch"
              : "Chưa có thông tin tiến độ"}
          </p>
        )}
      </div>
      <div className={styles.nextInfo}>
        {path.nextSession && (
          <Link
            className={styles.nextSession}
            href={`/learn/sessions/${path.nextSession.id}`}
          >
            <ProductIcon name="calendar" size={18} />
            <span>
              <strong>Buổi tới</strong>
              <span>{formatTime(path.nextSession.startAt)}</span>
            </span>
            <ProductIcon name="arrow" size={16} />
          </Link>
        )}
        {path.attentionCount > 0 && (
          <span className={styles.attention}>
            {path.attentionCount} việc cần theo dõi
          </span>
        )}
        {!path.nextSession && !(path.attentionCount > 0) && (
          <p className="muted">Chưa có hoạt động tiếp theo</p>
        )}
      </div>
      <Link
        className={`btn ${path.learningStage === "STOPPED" ? "" : "btn-primary"} ${styles.action}`}
        href={`/learn/paths/${path.id}`}
      >
        {stageLabel
          ? pathActionLabel(path.learningStage, path.attentionCount)
          : "Xem chi tiết lộ trình"}
        <ProductIcon name="arrow" size={16} />
      </Link>
    </article>
  );
}

export function PathsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải lộ trình"
      className={styles.grid}
    >
      {[0, 1, 2, 3].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className={`learner-card ${styles.skeleton}`}
        >
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </section>
  );
}
