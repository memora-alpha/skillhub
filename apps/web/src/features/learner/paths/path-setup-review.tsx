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
    <Panel title="Xem lại trước khi hoàn thành">
      <div className={styles.review}>
        <div>
          <div className={styles.reviewHeader}>
            <h3>Thỏa thuận</h3>
            <button
              type="button"
              className="btn"
              onClick={() => onEdit("overview")}
            >
              Xem / sửa thỏa thuận
            </button>
          </div>
          <PathAgreementSummary path={path} />
        </div>
        <div>
          <div className={styles.reviewHeader}>
            <h3>Kế hoạch học</h3>
            <button
              type="button"
              className="btn"
              onClick={() => onEdit("plans")}
            >
              Xem / sửa kế hoạch
            </button>
          </div>
          {path.plans.map((plan) => (
            <div key={plan.id} className={styles.reviewPlan}>
              <strong>{plan.learningGoal}</strong>
              <p>{plan.totalSessions} buổi</p>
              <ol>
                {plan.sessionOutline.map((item) => (
                  <li key={item.sessionNo}>
                    Buổi {item.sessionNo}: {item.content}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <div>
          <div className={styles.reviewHeader}>
            <h3>Lịch học</h3>
            <button
              type="button"
              className="btn"
              onClick={() => onEdit("schedule")}
            >
              Xem / sửa lịch học
            </button>
          </div>
          {path.plans.map((plan) => (
            <div key={plan.id} className={styles.reviewPlan}>
              <strong>{plan.learningGoal}</strong>
              <ul>
                {plan.schedule?.items.map((item) => (
                  <li key={item.sessionNo}>
                    Buổi {item.sessionNo}: {formatTime(item.startAt)} –{" "}
                    {formatTime(item.endAt)}
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
