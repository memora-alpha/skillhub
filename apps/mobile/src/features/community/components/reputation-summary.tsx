import { systemCodeLabel } from "@/constants/system-text";
import { Text, View } from "react-native";
import type { Reputation } from "../api/community-api";
import { restrictionDeadline } from "../utils/reputation-policy";
import { policyStyles as styles } from "./reputation-policy.styles";
import { ReputationScoreCard } from "./reputation-score-card";
const scopes: Record<string, string> = {
  ALL: "Hạn chế hoạt động tài khoản",
  "learning-request:create": "Hạn chế tạo yêu cầu học",
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
  RECOVERY_MISSION_REWARD: "Hoàn thành nhiệm vụ phục hồi uy tín",
};
function reviewDecisionText(decision: string | null) {
  if (decision === "APPROVED") return "Đã được xem xét và chấp thuận.";
  if (decision === "FOLLOW_UP_REQUIRED")
    return "Cần tiếp tục theo dõi theo quyết định xử lý.";
  return "Chưa có kết quả xem xét.";
}
export function ReputationSummary({ data }: Readonly<{ data: Reputation }>) {
  return (
    <View style={styles.stack}>
      <ReputationScoreCard data={data} />
      <View style={styles.section}>
        <Text style={styles.heading}>Hạn chế tài khoản</Text>
        {!data.activeRestrictions.length && (
          <Text style={styles.body}>Không có hạn chế đang hiệu lực.</Text>
        )}
        {data.activeRestrictions.map((item, index) => (
          <View key={`${item.scope}:${index}`} style={styles.restriction}>
            <Text style={styles.restrictionTitle}>
              {scopes[item.scope] ?? systemCodeLabel(item.scope)}
            </Text>
            <Text style={styles.body}>
              Lý do:{" "}
              {reputationReasons[item.reasonCode] ??
                systemCodeLabel(item.reasonCode)}
            </Text>
            <Text style={styles.note}>
              {restrictionDeadline(item.endsAt, !!data.policyNotice?.length)}
            </Text>
          </View>
        ))}
      </View>
      {!!data.restrictionReviews?.length && (
        <View style={styles.section}>
          <Text style={styles.heading}>Theo dõi xem xét hạn chế</Text>
          {data.restrictionReviews.map((review) => (
            <View key={review.id} style={styles.section}>
              <Text style={styles.restrictionTitle}>
                {scopes[review.scope]}
              </Text>
              <Text style={styles.note}>
                {reviewDecisionText(review.decision)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
