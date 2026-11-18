import { Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ReviewStars } from "@/features/community";
import type { MaterialReview } from "../api/material-reviews-api";
import { MaterialReviewReport } from "./material-review-report";
import { reviewStyles as styles } from "./material-review.styles";

export function MaterialReviewRow({
  review,
  ready,
  own = false,
}: Readonly<{ review: MaterialReview; ready: boolean; own?: boolean }>) {
  return (
    <View style={styles.row}>
      <View style={styles.reviewer}>
        <Avatar
          name={review.reviewer.fullName}
          userId={review.reviewer.userId}
          sourceUri={review.reviewer.avatarUrl}
          size={32}
        />
        <View style={styles.author}>
          <Text style={styles.name} numberOfLines={2}>
            {own ? "Bạn" : review.reviewer.fullName}
          </Text>
          <View style={styles.ratingLine}>
            <ReviewStars rating={review.rating} size={13} />
            {review.verifiedPurchase && (
              <Text style={styles.verified}>Đã mua</Text>
            )}
          </View>
        </View>
        {!own && <MaterialReviewReport reviewId={review.id} ready={ready} />}
      </View>
      {!!review.comment && (
        <Text selectable style={styles.body}>
          {review.comment}
        </Text>
      )}
    </View>
  );
}
