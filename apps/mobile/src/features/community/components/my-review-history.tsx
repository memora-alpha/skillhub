import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { IconAction } from "@/components/icon-action";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { ReviewCard } from "./review-card";
import { ReviewSummary } from "./review-summary";
import { reviewStyles as styles } from "./review.styles";
import { useUserReviews } from "../hooks/use-user-reviews";
import type { ReviewDirection } from "../api/user-reviews-api";

export function MyReviewHistory({
  direction,
}: Readonly<{ direction: ReviewDirection }>) {
  const runtime = useConnections();
  const query = useUserReviews(runtime.userId ?? "", true, direction);
  return (
    <>
      {direction === "received" && query.summary && (
        <View style={styles.form}>
          <ReviewSummary {...query.summary} expanded />
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.meta}>
          {query.items.length}
          {query.hasNextPage ? "+" : ""} nhận xét
        </Text>
        <IconAction
          icon="refresh"
          label="Làm mới đánh giá"
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
        />
      </View>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {query.denied && (
        <FormNotice tone="info">
          Bạn hiện không có quyền xem danh sách đánh giá.
        </FormNotice>
      )}
      {query.data && !query.error && !query.denied && !query.items.length && (
        <EmptyState
          icon="star"
          title={
            direction === "received"
              ? "Chưa có đánh giá nhận được"
              : "Bạn chưa gửi đánh giá nào"
          }
          description={
            direction === "received"
              ? "Nhận xét từ người học sẽ xuất hiện tại đây."
              : "Chọn mục Viết đánh giá để xem các lộ trình đã hoàn tất."
          }
          titleStyle={styles.sectionTitle}
        />
      )}
      {query.items.map((row) => {
        const person = direction === "sent" ? row.reviewee : row.reviewer;
        return (
          <ReviewCard
            key={row.id}
            name={person?.displayName ?? "Thành viên"}
            userId={person?.userId}
            subject={direction === "sent" ? "Bạn đánh giá" : undefined}
            rating={row.rating}
            comment={row.comment}
            createdAt={row.createdAt}
          />
        );
      })}
      {query.hasNextPage && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetching ? "Đang tải…" : "Xem thêm đánh giá"}
        </Button>
      )}
    </>
  );
}
