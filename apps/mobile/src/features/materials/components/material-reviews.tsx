import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { ReviewStars } from "@/features/community";
import type { ApiMaterial } from "../api/material-contracts";
import { useMaterialReviews } from "../hooks/use-material-reviews";
import { MaterialReviewRow } from "./material-review-row";
import { reviewStyles as styles } from "./material-review.styles";

export function MaterialReviews({
  material,
}: Readonly<{ material: ApiMaterial }>) {
  const { reviews, focused } = useMaterialReviews(material.id);
  const runtime = useConnections();
  const summary = reviews.summary;
  if (!reviews.data && !reviews.error && !reviews.denied) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Đánh giá</Text>
      {summary &&
        (summary.average === null ? (
          <Text style={styles.meta}>Chưa có đánh giá</Text>
        ) : (
          <View style={styles.summary}>
            <Text style={styles.score}>
              {Number(summary.average).toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}
            </Text>
            <View style={styles.summaryInfo}>
              <ReviewStars rating={Number(summary.average)} size={16} />
              <Text style={styles.meta}>
                {summary.total.toLocaleString("vi-VN")} đánh giá
              </Text>
            </View>
          </View>
        ))}
      <ConnectionFeedback error={reviews.error} retry={reviews.refetch} />
      {reviews.items.map((review) => (
        <MaterialReviewRow
          key={review.id}
          review={review}
          own={review.reviewer.userId === runtime.userId}
          ready={
            focused && runtime.enabled && !reviews.isFetching && !reviews.error
          }
        />
      ))}
      {reviews.hasNextPage && (
        <Button
          variant="paper"
          disabled={reviews.isFetching || !!reviews.error}
          onPress={() => void reviews.fetchNextPage()}
        >
          {reviews.isFetchingNextPage ? "Đang tải…" : "Xem thêm đánh giá"}
        </Button>
      )}
      {reviews.denied && (
        <FormNotice tone="info" compact>
          Đánh giá của tài liệu hiện không khả dụng.
        </FormNotice>
      )}
    </View>
  );
}
