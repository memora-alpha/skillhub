import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  ReviewCard,
  ReviewSummary,
  useUserReviews,
} from "@/features/community";
import { ConnectionFeedback } from "@/features/connections";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { ProfileSection } from "./ProfilePrimitives";

export function ProfileReviews({
  userId,
  own = false,
}: Readonly<{ userId: string; own?: boolean }>) {
  const router = useRouter();
  const query = useUserReviews(userId, own);
  const [expanded, setExpanded] = useState(false);
  return (
    <ProfileSection style={styles.section}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          {own ? "Đánh giá về bạn" : "Đánh giá"}
        </Text>
        {query.summary && (
          <Button
            variant="ghost"
            size="sm"
            icon="arrow"
            accessibilityLabel={
              own
                ? "Xem đánh giá về bạn"
                : expanded
                  ? "Thu gọn đánh giá"
                  : "Xem đánh giá"
            }
            accessibilityState={own ? undefined : { expanded }}
            onPress={() =>
              own ? router.push("/reviews") : setExpanded(!expanded)
            }
          >
            {own || !expanded ? "Xem tất cả" : "Thu gọn"}
          </Button>
        )}
      </View>
      {query.summary && (
        <ReviewSummary {...query.summary} expanded={!own && expanded} />
      )}
      <ConnectionFeedback
        loading={query.isLoading}
        loadingPresentation="placeholder"
        error={query.error}
        retry={query.refetch}
      />
      {query.denied && (
        <FormNotice tone="info">
          Đánh giá không còn khả dụng hoặc bạn không có quyền xem.
        </FormNotice>
      )}
      {!own && expanded && (
        <>
          {query.data &&
            !query.error &&
            !query.denied &&
            !query.items.length && (
              <Text style={styles.empty}>Chưa có đánh giá.</Text>
            )}
          {query.items.map((row) => (
            <ReviewCard
              key={row.id}
              name={row.reviewer?.displayName ?? "Thành viên"}
              userId={row.reviewer?.userId}
              rating={row.rating}
              comment={row.comment}
              createdAt={row.createdAt}
            />
          ))}
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
      )}
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  empty: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.muted,
    paddingVertical: 12,
  },
});
