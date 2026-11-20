import { LoadingSkeleton } from "@/components/loading-skeleton";
import styles from "./shell-skeleton.module.css";
import type { Portal } from "@/lib/staff/policy";

const navigationSlots = Array.from(
  { length: 9 },
  (_, position) => `navigation-${position + 1}`,
);

export function StaffShellSkeleton({
  portal = "staff",
}: Readonly<{ portal?: Portal }>) {
  return (
    <div
      className="shell staff-shell"
      data-portal={portal}
      data-admin-redesign="true"
    >
      <aside className={`side ${styles.sidebar}`} aria-hidden="true">
        <div className="side-head">
          <span className="logo">S</span>
          <div>
            <div className="side-title">
              Skill<em>Hub</em>
            </div>
            <div className="side-sub">
              {portal === "admin" ? "Cổng quản trị" : "Bàn vận hành"}
            </div>
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
