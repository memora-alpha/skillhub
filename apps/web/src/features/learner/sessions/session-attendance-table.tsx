import { LoadingButton } from "@/components/loading-button";
import type { LearningSession } from "../types";
import { formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
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

function verdictStyle(verdict: string | null | undefined) {
  if (verdict === "PRESENT") return ` ${styles.verdictPresent}`;
  if (verdict === "ABSENT") return ` ${styles.verdictAbsent}`;
  if (verdict === "UNVERIFIABLE") return ` ${styles.verdictWarn}`;
  return "";
}

function verdictIcon(verdict: string | null | undefined) {
  if (verdict === "PRESENT") return "check" as const;
  if (verdict === "ABSENT") return "alert" as const;
  return "clock" as const;
}

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
  const hasStatusNotes =
    pending ||
    session.attendance?.state === "UNVERIFIABLE" ||
    session.attendance?.outcomeStatus === "PROVISIONAL" ||
    Boolean(resolution && resultLabels[resolution]);

  return (
    <>
      <div className={styles.attendanceWrap}>
        <ul
          className={styles.attendance}
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

            return (
              <li key={side} className={styles.attendanceRow}>
                <div className={styles.attendanceTop}>
                  <div className={styles.person}>
                    <ProfileAvatar
                      fullName={person}
                      avatarUrl={self ? null : (partner?.avatarUrl ?? null)}
                      className={
                        styles.avatar +
                        (side === "teacher" ? ` ${styles.avatarTeacher}` : "")
                      }
                    />
                    <div className={styles.personMeta}>
                      <div className={styles.personNameRow}>
                        <strong>{person}</strong>
                        {self && <span className={styles.selfTag}>Bạn</span>}
                      </div>
                      <small>{role}</small>
                    </div>
                  </div>

                  <div className={styles.verdictGroup}>
                    <span
                      className={
                        styles.verdictPill + verdictStyle(value?.verdict)
                      }
                    >
                      <ProductIcon
                        name={verdictIcon(value?.verdict)}
                        size={13}
                      />
                      {verdict}
                    </span>
                    {value?.late && (
                      <span className={styles.latePill}>Vào muộn</span>
                    )}
                  </div>
                </div>

                <div className={styles.attendanceMetrics}>
                  <div className={styles.statTile}>
                    <span>Thời lượng ghi nhận</span>
                    <strong>{duration(value?.seconds, value?.verdict)}</strong>
                  </div>
                  <div className={styles.statTile}>
                    <span>Xác nhận sau buổi</span>
                    <strong
                      className={confirmed ? styles.confirmedText : undefined}
                    >
                      {confirmed ? "Đã xác nhận" : "Chưa xác nhận"}
                    </strong>
                    {confirmedAt && <small>{formatTime(confirmedAt)}</small>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {hasStatusNotes && (
          <div className={styles.notesStack}>
            {pending && (
              <output
                className={`${styles.statusNote} ${styles.statusNoteInfo}`}
              >
                <ProductIcon name="clock" size={16} />
                <span>
                  Máy chủ đang tổng hợp điểm danh. Chưa có số liệu không có
                  nghĩa là bạn đã học 0 giây hoặc vắng mặt.
                </span>
              </output>
            )}
            {session.attendance?.state === "UNVERIFIABLE" && (
              <p className={styles.statusNote}>
                <ProductIcon name="alert" size={16} />
                <span>
                  Chưa đủ dữ liệu để xác minh thời lượng. Đây chưa phải kết luận
                  vắng học; quyền xác nhận do máy chủ cấp.
                </span>
              </p>
            )}
            {session.attendance?.outcomeStatus === "PROVISIONAL" && (
              <p className={styles.statusNote}>
                <ProductIcon name="clock" size={16} />
                <span>
                  Kết quả còn trong thời hạn xử lý, chưa phải quyết định cuối
                  cùng. Theo dõi hạn phản hồi và các thao tác được phép.
                </span>
              </p>
            )}
            {resolution && resultLabels[resolution] && (
              <p className={`${styles.statusNote} ${styles.statusNoteOk}`}>
                <ProductIcon name="check" size={16} />
                <span>{resultLabels[resolution]}</span>
              </p>
            )}
          </div>
        )}

        {!hideRefresh && (
          <div>
            <LoadingButton
              type="button"
              className="btn"
              disabled={loading}
              onClick={refresh}
              loading={!!loading}
            >
              <ProductIcon name="refresh" size={15} />
              {loading
                ? "Đang tải điểm danh…"
                : "Tải lại điểm danh và quyền xác nhận"}
            </LoadingButton>
          </div>
        )}
      </div>

      <p className={styles.footerNote}>
        <ProductIcon name="info" size={15} />
        <span>
          Rời phòng không tự xác nhận hoàn tất. Điểm danh và kết quả do máy chủ
          ghi nhận.
        </span>
      </p>
    </>
  );
}
