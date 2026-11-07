import { Badge } from "@/components/Badge";
import { Copy, Metric, Panel } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Reputation } from "../api/community-api";
import { useCommunityApi } from "../hooks/use-community";

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
  RECOVERY_MISSION_REWARD: "Thưởng nhiệm vụ phục hồi",
  RECOVERY_REWARD_REVOKED: "Thu hồi thưởng phục hồi",
  PENALTY_REVERSED: "Hoàn điểm do hủy xử phạt",
};
export function ReputationSummary({ data }: Readonly<{ data: Reputation }>) {
  const runtime = useConnections();
  const api = useCommunityApi();
  const cache = useQueryClient();
  const policy = useMutation({
    mutationFn: api.acknowledgeReputationPolicy,
    onSuccess: async () => {
      if (runtime.isCurrent())
        await cache.invalidateQueries({
          queryKey: [...runtime.key, "reputation"],
        });
    },
  });
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
        {data.activeRestrictions.some(
          ({ scope }) => scope === "CREATE_NEW_ACTIVITY",
        ) && (
          <Copy muted>
            {data.policyNotice
              ? "Quyền tạo yêu cầu học và đề xuất mở lại khi hết thời hạn khóa và bạn xác nhận đã đọc chính sách."
              : "Quyền tạo yêu cầu học và đề xuất mở lại khi hết thời hạn khóa. Việc xét duyệt được theo dõi riêng."}
          </Copy>
        )}
      </Panel>
      {data.policyNotice && (
        <Panel title="Xác nhận đã đọc chính sách">
          {data.policyNotice.map((rule) => (
            <Copy key={rule}>{rule}</Copy>
          ))}
          <ConnectionFeedback loading={policy.isPending} error={policy.error} />
          <Button disabled={policy.isPending} onPress={() => policy.mutate()}>
            Tôi đã đọc chính sách
          </Button>
        </Panel>
      )}
      {Boolean(data.restrictionReviews?.length) && (
        <Panel title="Xét duyệt hạn chế">
          {data.restrictionReviews?.map(({ id, scope, decision }) => (
            <Copy key={id}>
              {scopes[scope]} ·{" "}
              {decision === "APPROVED"
                ? "Đã duyệt"
                : decision === "FOLLOW_UP_REQUIRED"
                  ? "Cần theo dõi thêm"
                  : "Đang chờ xét duyệt"}
            </Copy>
          ))}
        </Panel>
      )}
    </>
  );
}
