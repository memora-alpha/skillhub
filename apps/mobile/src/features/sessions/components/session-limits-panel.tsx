import type { LearningSession } from "../types";
import { SessionPanel, SessionCopy, SessionRouteButton } from "./session-page";
export function SessionLimitsPanel({
  session,
}: Readonly<{ session: LearningSession }>) {
  const q = session.makeupQuota;
  return (
    <SessionPanel title="Đổi lịch & lượt học bù">
      <SessionCopy>
        Đã đổi lịch thông thường: {session.rescheduleCount ?? "Chưa có dữ liệu"}
        /3 lần. Mỗi buổi học bù tối đa một lần.
      </SessionCopy>
      {session.originalStartAt && (
        <SessionCopy muted>
          Lịch gốc: {new Date(session.originalStartAt).toLocaleString("vi-VN")}
        </SessionCopy>
      )}
      {q && (
        <>
          <SessionCopy>
            Lượt của bạn: đã dùng {q.used}/{q.limit}, còn {q.remaining} · Tổng{" "}
            {q.totalSessions} buổi tham gia trong thỏa thuận.
          </SessionCopy>
          {q.requiresReview && (
            <SessionCopy>
              Lịch sử học bù cần nhân sự xác minh trước khi cấp thêm lượt.
            </SessionCopy>
          )}
        </>
      )}
      <SessionCopy muted>
        Lượt dùng chung cả chiều dạy và học. Hủy tính cho người yêu cầu, vắng
        tính cho người vắng. Hết lượt cần nhân sự xử lý. Đổi lịch phải giữ thứ
        tự buổi; buổi cuối dời tối đa 48 giờ từ lịch gốc.
      </SessionCopy>
      <SessionRouteButton secondary href={`/paths/${session.pathId}`}>
        Xem lộ trình, quyết toán & đánh giá
      </SessionRouteButton>
    </SessionPanel>
  );
}
