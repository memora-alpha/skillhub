import type { LearningSession } from "../types";
import { formatTime } from "../components/common";
import { attendanceSideText } from "./attendance-presentation";

export function SessionAttendanceStatus({
  session,
  userId,
  loading,
  refresh,
}: {
  session: LearningSession;
  userId: string;
  loading: boolean;
  refresh: () => void;
}) {
  const pending = session.attendance?.state === "PENDING_DATA";
  const ownConfirmed =
    (userId === session.teacherId
      ? session.teacherConfirmationStatus
      : session.learnerConfirmationStatus) === "CONFIRMED";
  return (
    <>
      {pending && (
        <p className="learner-notice" role="status">
          Máy chủ đang tổng hợp điểm danh. Chưa có số liệu không có nghĩa là bạn
          đã học 0 giây hoặc vắng mặt. Chức năng xác nhận sẽ xuất hiện khi máy
          chủ cho phép. Trang tự kiểm tra lại mỗi 30 giây khi đang mở.
        </p>
      )}
      {session.attendance?.state === "UNVERIFIABLE" && (
        <p className="learner-notice">
          Máy chủ chưa đủ dữ liệu xác minh điểm danh. Đây chưa phải kết luận
          vắng học. Thao tác xác nhận theo quyền máy chủ cấp bên dưới.
        </p>
      )}
      {(["teacher", "learner"] as const).map((side) => {
        const value = session.attendance?.[side];
        const confirmed =
          (side === "teacher"
            ? session.teacherConfirmationStatus
            : session.learnerConfirmationStatus) === "CONFIRMED";
        return (
          <div key={side}>
            <p>
              <strong>{side === "teacher" ? "Người dạy" : "Người học"}:</strong>{" "}
              {attendanceSideText(value)}
            </p>
            <p className="muted">
              {confirmed ? "Đã xác nhận hoàn tất" : "Chưa xác nhận hoàn tất"}
              {value?.firstJoinedAt
                ? ` · Vào phòng lần đầu: ${formatTime(value.firstJoinedAt)}`
                : pending
                  ? " · Máy chủ chưa trả thời điểm vào phòng"
                  : ""}
            </p>
          </div>
        );
      })}
      {ownConfirmed && session.status === "AWAITING_CONFIRMATION" && (
        <p className="learner-notice">
          Bạn đã xác nhận. Đang chờ người cùng học xác nhận và máy chủ cập nhật
          kết quả.
        </p>
      )}
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
    </>
  );
}
