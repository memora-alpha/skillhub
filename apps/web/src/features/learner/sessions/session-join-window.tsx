import type { LearningSession } from "../types";
import { formatTime } from "../components/common";
export function SessionJoinWindow({
  session,
}: Readonly<{ session?: LearningSession }>) {
  if (!session?.join) return null;
  return (
    <div className="learner-notice" aria-label="Thời gian mở và đóng phòng">
      {session.join.opensAt && (
        <p>Mở phòng: {formatTime(session.join.opensAt)}</p>
      )}
      {session.join.closesAt && (
        <p>Đóng phòng: {formatTime(session.join.closesAt)}</p>
      )}
      <p>
        Giờ do máy chủ cung cấp. Vào phòng hoặc ở lại phòng không tự xác nhận
        hoàn thành buổi học.
      </p>
    </div>
  );
}
