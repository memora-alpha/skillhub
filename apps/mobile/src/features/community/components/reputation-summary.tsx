import { Badge } from "@/components/Badge";
import { Copy, Metric, Panel } from "@/components/feature-page";
import type { Reputation } from "../api/community-api";

const levels: Record<string, string> = {
  EXCELLENT: "Rất tốt",
  NORMAL: "Bình thường",
  WARNING: "Cảnh báo",
  RESTRICTED: "Hạn chế",
  LOW: "Thấp",
  SEVERE: "Rất thấp",
  CRITICAL: "Nghiêm trọng",
};
const scopes: Record<string, string> = {
  CREATE_NEW_ACTIVITY: "Hạn chế tạo hoạt động mới",
  REQUIRE_STAFF_REVIEW: "Cần nhân viên xem xét",
  REQUIRE_ADMIN_REVIEW: "Cần quản trị viên xem xét",
};
export const reputationReasons: Record<string, string> = {
  PATH_COMPLETED: "Hoàn thành lộ trình",
  REVIEW_RATING: "Đánh giá từ người trao đổi",
  LOW_REPUTATION: "Điểm uy tín thấp",
  ADJUDICATED_VIOLATION: "Quyết định xử lý vi phạm",
  LATE_CANCELLATION: "Hủy lịch muộn",
  NO_SHOW: "Vắng mặt",
  LIGHT_VIOLATION: "Vi phạm nhẹ",
  MEDIUM_HARASSMENT: "Quấy rối",
  FRAUD: "Gian lận",
};
export function ReputationSummary({ data }: Readonly<{ data: Reputation }>) {
  return (
    <>
      <Panel title="Uy tín tài khoản" accent>
        <Metric label="Điểm uy tín" value={`${data.reputationScore} / 100`} />
        <Badge label={levels[data.level] ?? data.level} />
        <Copy muted>
          Điểm và hạn chế được hệ thống cập nhật theo hoạt động và quyết định xử
          lý.
        </Copy>
      </Panel>
      <Panel title="Hạn chế tài khoản hiện tại">
        {!data.activeRestrictions.length && (
          <Copy>Không có hạn chế đang hiệu lực.</Copy>
        )}
        {data.activeRestrictions.map((item, index) => (
          <Copy key={`${item.scope}:${index}`}>
            {scopes[item.scope] ?? item.scope}
            {"\n"}
            Lý do: {reputationReasons[item.reasonCode] ?? item.reasonCode}
            {"\n"}
            Đến {new Date(item.endsAt).toLocaleString("vi-VN")}
          </Copy>
        ))}
      </Panel>
    </>
  );
}
