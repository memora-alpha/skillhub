import { Text, View } from "react-native";
import { appColors as colors } from "@/constants/theme";
import { systemCodeLabel } from "@/constants/system-text";
import type { Reputation } from "../api/community-api";
import { restrictionDeadline } from "../utils/reputation-policy";
import {
  reputationReasons,
  restrictionScopes,
  matchingRestrictionReview,
  reviewDecisionText,
  reputationDate,
} from "../utils/reputation-presentation";
import { ReputationScoreCard } from "./reputation-score-card";
import { reputationStyles as styles } from "./reputation.styles";
export { reputationReasons } from "../utils/reputation-presentation";

export function ReputationSummary({
  data,
  compact = false,
}: Readonly<{ data: Reputation; compact?: boolean }>) {
  const pastReviews =
    data.restrictionReviews?.filter(
      (review) =>
        !data.activeRestrictions.some(
          (restriction) =>
            restriction.scope === review.scope &&
            restriction.endsAt === review.endsAt,
        ),
    ) ?? [];
  return (
    <View style={styles.stack}>
      <ReputationScoreCard data={data} compact={compact} />
      {!data.activeRestrictions.length ? (
        <View style={styles.status}>
          <View
            style={[
              styles.statusDot,
              data.level === "WARNING" && { backgroundColor: colors.warning },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              data.level === "WARNING" && { color: colors.warning },
            ]}
          >
            {data.level === "WARNING"
              ? "Điểm đang ở mức cảnh báo · Chưa có hạn chế áp dụng"
              : "Không có hạn chế đang áp dụng"}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Hạn chế đang áp dụng
          </Text>
          {data.activeRestrictions.map((item, index) => {
            const review = matchingRestrictionReview(
              data,
              item.scope,
              item.endsAt,
            );
            return (
              <View
                key={`${item.scope}:${item.endsAt}:${index}`}
                style={[styles.item, index > 0 && styles.separator]}
              >
                <Text style={styles.label}>
                  {restrictionScopes[item.scope] ?? systemCodeLabel(item.scope)}
                </Text>
                <Text style={styles.meta}>
                  {reputationReasons[item.reasonCode] ??
                    systemCodeLabel(item.reasonCode)}
                </Text>
                <Text style={styles.body}>
                  {restrictionDeadline(
                    item.endsAt,
                    !!data.policyNotice?.length,
                  )}
                </Text>
                {review && (
                  <Text style={styles.meta}>
                    {reviewDecisionText(review.decision)}
                    {review.reviewedAt
                      ? ` · ${reputationDate(review.reviewedAt)}`
                      : ""}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
      {!compact && pastReviews.length > 0 && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Xem xét hạn chế
          </Text>
          {pastReviews.map((review, index) => (
            <View
              key={review.id}
              style={[styles.item, index > 0 && styles.separator]}
            >
              <Text style={styles.label}>
                {restrictionScopes[review.scope]}
              </Text>
              <Text style={styles.body}>
                {reviewDecisionText(review.decision)}
              </Text>
              <Text style={styles.meta}>
                Thời hạn: {reputationDate(review.endsAt)}
              </Text>
              {review.reviewedAt && (
                <Text style={styles.meta}>
                  Đã xem xét: {reputationDate(review.reviewedAt)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
