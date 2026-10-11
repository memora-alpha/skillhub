import { ActivityIndicator, Text, View } from "react-native";
import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import { skillError } from "../utils/skill-errors";
import { skillStyles } from "./SkillsLayout";
type FeedbackQuery = {
  data?: unknown;
  error: unknown;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};
export function QueryFeedback({
  query,
  empty = false,
  emptyText = "Chưa có dữ liệu.",
}: {
  query: FeedbackQuery;
  empty?: boolean;
  emptyText?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {query.error ? (
        <>
          <FormNotice tone="error">{skillError(query.error)}</FormNotice>
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
          >
            Thử tải lại
          </Button>
        </>
      ) : (
        !query.data && (
          <>
            <ActivityIndicator accessibilityLabel="Đang tải dữ liệu" />
            <Text style={skillStyles.caption}>Đang tải…</Text>
          </>
        )
      )}
      {!!query.data && empty && (
        <Text style={skillStyles.caption}>{emptyText}</Text>
      )}
    </View>
  );
}
export function PageFooter({
  query,
}: {
  query: FeedbackQuery & {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
  };
}) {
  return (
    <View style={{ gap: 8 }}>
      <QueryFeedback query={query} />
      {query.hasNextPage && (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
        </Button>
      )}
    </View>
  );
}
