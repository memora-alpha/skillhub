import type { LearningSession } from "../types";
import { formatTime } from "../components/common";
import styles from "./session-detail.module.css";

export function SessionJoinWindow({
  session,
}: Readonly<{ session?: LearningSession }>) {
  if (!session?.join) return null;
  const hasTimes = Boolean(session.join.opensAt || session.join.closesAt);
  return (
    <div
      className={styles.joinWindowBox}
      aria-label="Thời gian mở và đóng phòng"
    >
      {hasTimes && (
        <div className={styles.joinWindowGrid}>
          {session.join.opensAt && (
            <div className={styles.joinWindowTile}>
              <span>Mở phòng</span>
              <strong>{formatTime(session.join.opensAt)}</strong>
            </div>
          )}
          {session.join.closesAt && (
            <div className={styles.joinWindowTile}>
              <span>Đóng phòng</span>
              <strong>{formatTime(session.join.closesAt)}</strong>
            </div>
          )}
        </div>
      )}
      <p className={styles.joinWindowNote}>
        Giờ do máy chủ cung cấp. Vào phòng hoặc ở lại phòng không tự xác nhận
        hoàn thành buổi học.
      </p>
    </div>
  );
}
