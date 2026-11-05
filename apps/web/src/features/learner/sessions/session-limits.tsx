import type { LearningSession } from "../types";
import { Panel, formatTime } from "../components/common";
export function SessionLimits({
  session,
}: Readonly<{ session: LearningSession }>) {
  const quota = session.makeupQuota;
  return (
    <Panel title="Đổi lịch & hạn mức học bù">
      <p>
        Đã đổi lịch thông thường: {session.rescheduleCount ?? "Chưa có dữ liệu"}
        /3 lần. Mỗi buổi được học bù tối đa một lần.
      </p>
      {session.originalStartAt && (
        <p>Lịch gốc: {formatTime(session.originalStartAt)}</p>
      )}
      {quota && (
        <>
          <p>
            Lượt học bù của bạn trong thỏa thuận: đã dùng {quota.used}/
            {quota.limit}, còn {quota.remaining} lượt · Tổng{" "}
            {quota.totalSessions} buổi tham gia.
          </p>
          {quota.requiresReview && (
            <p className="learner-notice">
              Lịch sử học bù cần nhân sự xác minh trước khi cấp thêm lượt.
            </p>
          )}
        </>
      )}
      <p className="muted">
        Hạn mức dùng chung cả chiều dạy và chiều học. Hủy tính cho người yêu
        cầu; vắng tính cho người được xác định vắng. Hết lượt cần nhân sự xử lý.
        Đổi lịch phải giữ thứ tự buổi; buổi cuối dời tối đa 48 giờ từ lịch gốc.
      </p>
    </Panel>
  );
}
