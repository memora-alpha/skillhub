import { Text, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import type { LoadingPresentation } from "@/components/LoadingIndicator";
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
  loadingPresentation = "screen",
}: Readonly<{
  query: FeedbackQuery;
  empty?: boolean;
  emptyText?: string;
  loadingPresentation?: LoadingPresentation;
}>) {
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
            <ActivityIndicator
              presentation={loadingPresentation}
              accessibilityLabel="Đang tải dữ liệu"
            />
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
}: Readonly<{
  query: FeedbackQuery & {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
  };
}>) {
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
