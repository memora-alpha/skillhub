import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import { useLearningPaths } from "@/features/learning-paths";
import { ReviewPathCard } from "../components/review-path-card";
import { ReviewTabs, type ReviewTab } from "../components/review-tabs";
import { MyReviewHistory } from "../components/my-review-history";
import { reviewStyles as styles } from "../components/review.styles";

export { ReviewEditorScreen } from "./review-editor-screen";

export function ReviewsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const router = useRouter();
  const selected: ReviewTab =
    tab === "sent" || tab === "write" ? tab : "received";
  return (
    <FeaturePage title="Đánh giá" back="/profile">
      <ReviewTabs
        value={selected}
        onChange={(value) => router.setParams({ tab: value })}
      />
      {selected === "write" ? (
        <ReviewPaths />
      ) : (
        <MyReviewHistory key={selected} direction={selected} />
      )}
    </FeaturePage>
  );
}

function ReviewPaths() {
  const query = useLearningPaths();
  const items = query.data?.filter((path) => path.status === "COMPLETED") ?? [];
  return (
    <>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Lộ trình đã hoàn tất
        </Text>
        <Button
          variant="paper"
          size="sm"
          leadingIcon="refresh"
          disabled={query.isFetching}
          accessibilityLabel="Làm mới lộ trình"
          onPress={() => void query.refetch()}
        >
          Làm mới
        </Button>
      </View>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {query.denied && (
        <FormNotice tone="info">
          Bạn hiện không có quyền xem danh sách lộ trình.
        </FormNotice>
      )}
      {query.data && !query.error && !query.denied && !items.length && (
        <EmptyState
          icon="star"
          title="Chưa có lộ trình để đánh giá"
          description="Đánh giá sẽ mở khi lộ trình hoàn tất và được quyết toán."
          titleStyle={styles.sectionTitle}
        />
      )}
      {items.map((path) => (
        <ReviewPathCard key={path.id} path={path} />
      ))}
    </>
  );
}
