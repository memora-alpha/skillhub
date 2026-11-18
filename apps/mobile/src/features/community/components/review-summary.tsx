import { StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { ReviewStars } from "./review-stars";

export function ReviewSummary({
  averageRating,
  reviewCount,
  ratingDistribution,
  expanded = false,
}: Readonly<{
  averageRating: number | null;
  reviewCount: number;
  ratingDistribution: Record<string, number>;
  expanded?: boolean;
}>) {
  return (
    <View style={styles.summary}>
      <View style={styles.overview}>
        <Text selectable style={styles.score}>
          {averageRating === null
            ? "—"
            : averageRating.toLocaleString("vi-VN", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
        </Text>
        <View style={styles.detail}>
          {averageRating !== null && (
            <ReviewStars rating={averageRating} size={18} />
          )}
          <Text style={styles.caption}>
            {reviewCount > 0
              ? `${reviewCount.toLocaleString("vi-VN")} đánh giá nhận được`
              : "Chưa có đánh giá"}
          </Text>
        </View>
      </View>
      {expanded && reviewCount > 0 && (
        <View style={styles.distribution}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingDistribution[String(star)] ?? 0;
            const width = Math.max(
              0,
              Math.min(100, (count / reviewCount) * 100),
            );
            return (
              <View
                key={star}
                accessible
                accessibilityLabel={`${star} sao: ${count} đánh giá`}
                style={styles.row}
              >
                <Text style={styles.starLabel}>{star}</Text>
                <View style={styles.track}>
                  <View style={[styles.bar, { width: `${width}%` }]} />
                </View>
                <Text style={styles.count}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 16 },
  overview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  score: {
    fontFamily: fonts.bold,
    ...typography.amount,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  detail: { gap: 6 },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  distribution: { gap: 6 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  starLabel: {
    width: 14,
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceInset,
    borderRadius: appRadius.full,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: colors.star,
    borderRadius: appRadius.full,
  },
  count: {
    minWidth: 24,
    textAlign: "right",
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
});
