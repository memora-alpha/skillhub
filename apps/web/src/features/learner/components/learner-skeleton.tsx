import { LoadingSkeleton } from "@/components/loading-skeleton";
import styles from "./learner-skeleton.module.css";

function Line({ wide = false }: Readonly<{ wide?: boolean }>) {
  return <span className={wide ? styles.wide : styles.line} />;
}

export function LearnerContentSkeleton() {
  return <LoadingSkeleton variant="page" label="Đang tải nội dung học tập" />;
}
export function LearnerShellSkeleton() {
  return (
    <div className="learner-root workspace">
      <aside className={"app-sidebar " + styles.sidebar} aria-hidden="true">
        <div className="sidebar-head">
          <div className="app-brand">
            <span>S</span>
            <b>
              Skill<i>Hub</i>
            </b>
          </div>
        </div>
        <div className={styles.nav}>
          {Array.from({ length: 10 }, (_, key) => (
            <div key={key} className={styles.navRow}>
              <span className={styles.smallIcon} />
              <Line wide />
            </div>
          ))}
        </div>
      </aside>
      <div className="workspace-main">
        <div className={"app-header " + styles.header} aria-hidden="true">
          <span className={styles.search} />
          <span className={styles.wallet} />
          <span className={styles.smallIcon} />
          <div className={styles.profile}>
            <span className={styles.icon} />
            <Line wide />
          </div>
        </div>
        <main className="app-content">
          <LearnerContentSkeleton />
        </main>
      </div>
    </div>
  );
}
