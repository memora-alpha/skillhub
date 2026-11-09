import { useLocalSearchParams } from "expo-router";
import { FlowPage } from "@/components/learning-flow";
import { Copy } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { uuid } from "@/lib/http/contracts";
import { usePathCases } from "../hooks/use-path-overview";
import { ParticipantCaseCard } from "../components/participant-case-card";
import { PathReadFeedback } from "../components/PathReadFeedback";

export function PathCasesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const valid = uuid.safeParse(id).success;
  const query = usePathCases(id);
  const refresh = () => query.refetch({ cancelRefetch: false });
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetching && !query.denied)
      void query.fetchNextPage({ cancelRefetch: false });
  };
  return (
    <FlowPage
      title="Vụ việc của thỏa thuận"
      back={valid ? `/paths/${id}` : "/my-learning?tab=paths"}
      backBehavior="history"
      scrollable={false}
    >
      <RefreshableFlatList
        data={query.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            <Copy muted size="hint">
              Các vụ việc liên quan thỏa thuận, bao gồm vụ việc do đối tác hoặc
              hệ thống ghi nhận. Chỉ hiển thị thông tin dành cho người tham gia.
            </Copy>
            <PathReadFeedback
              query={{
                ...query,
                refetch: query.isFetchNextPageError ? loadMore : refresh,
              }}
            />
          </>
        }
        ListEmptyComponent={
          !valid ? (
            <EmptyState
              title="Mã thỏa thuận không hợp lệ"
              description="Mở lại từ danh sách lộ trình."
            />
          ) : query.data && !query.denied ? (
            <EmptyState
              title="Chưa có vụ việc"
              description="Chưa ghi nhận vụ việc liên quan thỏa thuận này."
            />
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage && !query.denied ? (
            <Button
              variant="paper"
              disabled={query.isFetching}
              onPress={loadMore}
            >
              {query.isFetchingNextPage
                ? "Đang tải thêm…"
                : query.isFetchNextPageError
                  ? "Thử tải thêm vụ việc"
                  : "Tải thêm vụ việc"}
            </Button>
          ) : null
        }
        renderItem={({ item }) => <ParticipantCaseCard item={item} />}
        refreshing={query.isRefetching}
        onRefresh={() => void refresh()}
        onEndReached={() => {
          if (query.items.length && !query.error) loadMore();
        }}
      />
    </FlowPage>
  );
}
