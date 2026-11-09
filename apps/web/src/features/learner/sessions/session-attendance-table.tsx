import type { LearningSession } from "../types";
import { formatTime } from "../components/common";
import { ProfileAvatar } from "../components/profile-avatar";
import styles from "./session-detail.module.css";

function duration(
  seconds: string | undefined,
  verdict: string | null | undefined,
) {
  if (!verdict || !seconds || !/^\d+$/.test(seconds)) return "Chưa có dữ liệu";
  const value = BigInt(seconds);
  return `${value / 60n} phút ${value % 60n} giây`;
}
const verdictLabels: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng mặt",
  UNVERIFIABLE: "Chưa xác minh",
};
const resultLabels: Record<string, string> = {
  COMPLETED_MUTUAL: "Hoàn thành sau xác nhận hai bên.",
  COMPLETED_TIMEOUT:
    "Máy chủ chốt hoàn thành khi hết thời hạn xác nhận và đủ điều kiện.",
  COMPLETED_LEARNER_NO_SHOW:
    "Buổi được tính đã sử dụng theo kết quả vắng của người học.",
  COMPLETED_STAFF: "Buổi được chốt hoàn thành theo quyết định xử lý.",
};

export function SessionAttendanceTable({
  session,
  userId,
  loading,
  refresh,
  hideRefresh = false,
  partner,
}: Readonly<{
  session: LearningSession;
  userId: string;
  loading: boolean;
  refresh: () => void;
  hideRefresh?: boolean;
  partner?: { fullName: string; avatarUrl: string | null };
}>) {
  const pending = session.attendance?.state === "PENDING_DATA";
  const noAttendance = session.status === "CANCELLED";
  const resolution = session.attendance?.resolution;
  return (
    <>
      <div
        className={styles.attendance}
        role="list"
        aria-label="Kết quả của từng người tham gia"
      >
        {(["teacher", "learner"] as const).map((side) => {
          const role = side === "teacher" ? "Người dạy" : "Người học";
          const self =
            (side === "teacher" ? session.teacherId : session.learnerId) ===
            userId;
          const person = self ? "Bạn" : (partner?.fullName ?? role);
          const value = session.attendance?.[side];
          const confirmed =
            (side === "teacher"
              ? session.teacherConfirmationStatus
              : session.learnerConfirmationStatus) === "CONFIRMED";
          const confirmedAt =
            side === "teacher"
              ? session.teacherConfirmedAt
              : session.learnerConfirmedAt;
          const verdict =
            noAttendance && !value?.verdict
              ? "Không áp dụng"
              : (verdictLabels[value?.verdict ?? ""] ?? "Chờ dữ liệu");
          let verdictClass: string | undefined;
          if (value?.verdict === "ABSENT") verdictClass = styles.absent;
          else if (value?.verdict === "PRESENT") verdictClass = styles.present;
          return (
            <div key={side} className={styles.attendanceRow} role="listitem">
              <div className={styles.person}>
                <ProfileAvatar
                  fullName={person}
                  avatarUrl={self ? null : (partner?.avatarUrl ?? null)}
                  className={styles.avatar}
                />
                <div>
                  <strong>{person}</strong>
                  <small>{role}</small>
                </div>
              </div>
              <div className={styles.stat}>
                <span>Kết quả</span>
                <strong className={verdictClass}>{verdict}</strong>
                {value?.late && <small>Vào muộn</small>}
              </div>
              <div className={styles.stat}>
                <span>Thời lượng ghi nhận</span>
                <strong>{duration(value?.seconds, value?.verdict)}</strong>
              </div>
              <div className={styles.stat}>
                <span>Xác nhận</span>
                <strong>{confirmed ? "Đã xác nhận" : "Chưa xác nhận"}</strong>
                {confirmedAt && <small>{formatTime(confirmedAt)}</small>}
              </div>
            </div>
          );
        })}
      </div>
      {pending && (
        <p className={styles.note} role="status">
          Máy chủ đang tổng hợp điểm danh. Chưa có số liệu không có nghĩa là bạn
          đã học 0 giây hoặc vắng mặt.
        </p>
      )}
      {session.attendance?.state === "UNVERIFIABLE" && (
        <p className={styles.note}>
          Chưa đủ dữ liệu để xác minh thời lượng. Đây chưa phải kết luận vắng
          học; quyền xác nhận do máy chủ cấp.
        </p>
      )}
      {session.attendance?.outcomeStatus === "PROVISIONAL" && (
        <p className={styles.note}>
          Kết quả còn trong thời hạn xử lý, chưa phải quyết định cuối cùng. Theo
          dõi hạn phản hồi và các thao tác được phép.
        </p>
      )}
      {resolution && resultLabels[resolution] && (
        <p className={styles.note}>{resultLabels[resolution]}</p>
      )}
      <p className={styles.note}>
        Rời phòng không tự xác nhận hoàn tất. Điểm danh và kết quả do máy chủ
        ghi nhận.
      </p>
      {!hideRefresh && (
        <div className={styles.content}>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={refresh}
          >
            {loading
              ? "Đang tải điểm danh…"
              : "Tải lại điểm danh và quyền xác nhận"}
          </button>
        </div>
      )}
    </>
  );
}
