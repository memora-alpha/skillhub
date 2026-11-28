import type { LearningPath } from "../types";
import { Panel, formatTime } from "../components/common";
import { PathAgreementSummary } from "./agreement-summary";
import type { PathSetupStep } from "./path-setup-policy";
import styles from "./path-setup-flow.module.css";

export function PathSetupReview({
  path,
  onEdit,
}: Readonly<{
  path: LearningPath;
  onEdit: (step: PathSetupStep) => void;
}>) {
  return (
    <Panel title="Tổng hợp trước khi chốt lịch">
      <div className={styles.review}>
        <div className={styles.reviewSection}>
          <div className={styles.reviewHeader}>
            <h3>1. Thỏa thuận học tập</h3>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onEdit("overview")}
            >
              Xem / sửa thỏa thuận
            </button>
          </div>
          <PathAgreementSummary path={path} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewHeader}>
            <h3>2. Kế hoạch học ({path.plans.length})</h3>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onEdit("plans")}
            >
              Xem / sửa kế hoạch
            </button>
          </div>
          {path.plans.map((plan) => (
            <div key={plan.id} className={styles.reviewPlan}>
              <div className={styles.reviewPlanHead}>
                <strong>{plan.learningGoal}</strong>
                <span className="muted">{plan.totalSessions} buổi</span>
              </div>
              <ol className={styles.reviewList}>
                {plan.sessionOutline.map((item) => (
                  <li key={item.sessionNo}>
                    <strong>Buổi {item.sessionNo}:</strong>
                    <span>{item.content}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewHeader}>
            <h3>3. Lịch học dự kiến</h3>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onEdit("schedule")}
            >
              Xem / sửa lịch học
            </button>
          </div>
          {path.plans.map((plan) => (
            <div key={plan.id} className={styles.reviewPlan}>
              <div className={styles.reviewPlanHead}>
                <strong>{plan.learningGoal}</strong>
                <span className="muted">
                  {plan.schedule?.items.length ?? 0}/{plan.totalSessions} buổi
                </span>
              </div>
              <ul className={styles.reviewList}>
                {plan.schedule?.items.map((item) => (
                  <li key={item.sessionNo}>
                    <strong>Buổi {item.sessionNo}:</strong>
                    <span>
                      {formatTime(item.startAt)} – {formatTime(item.endAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
