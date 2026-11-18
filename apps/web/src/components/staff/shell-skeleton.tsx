import { LoadingSkeleton } from "@/components/loading-skeleton";
import styles from "./shell-skeleton.module.css";

const navigationSlots = Array.from(
  { length: 10 },
  (_, position) => `navigation-${position + 1}`,
);

export function StaffShellSkeleton() {
  return (
    <div className="shell staff-shell">
      <aside className={`side ${styles.sidebar}`} aria-hidden="true">
        <div className="side-head">
          <span className="logo">S</span>
          <div>
            <div className="side-title">SkillHub</div>
            <div className="side-sub">Không gian vận hành</div>
          </div>
        </div>
        <div className={styles.navigation}>
          {navigationSlots.map((slot) => (
            <span className={styles.item} key={slot} />
          ))}
        </div>
      </aside>
      <div className="main-col">
        <div className="topbar" aria-hidden="true">
          <span className={styles.item} />
        </div>
        <main className="content">
          <LoadingSkeleton
            variant="page"
            label="Đang tải không gian làm việc"
          />
        </main>
      </div>
    </div>
  );
}
