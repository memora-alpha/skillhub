import { useState } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Copy, ui } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import { useProposalList } from "../hooks/use-proposals-api";
import { ApiProposalSummary } from "../components/ApiProposalSummary";
import {
  ProposalListFilters,
  type ProposalListTab,
} from "../components/ProposalListFilters";
import {
  ProposalSearchButton,
  ProposalSearchField,
} from "../components/ProposalSearch";
import { searchProposals } from "../utils/search-proposals";
import { proposalListFilter } from "../utils/proposal-route";
import { ProposalUnavailable } from "../components/ProposalUnavailable";

export function ApiProposalsScreen() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const filter = proposalListFilter(useLocalSearchParams());
  const direction = filter?.direction ?? "all",
    status = filter?.status;
  const query = useProposalList(
    direction,
    status,
    filter?.learningRequestId,
    !!filter,
  );
  if (!filter) return <ProposalUnavailable />;
  const selectedTab = status ?? (direction === "all" ? "all" : undefined);
  const selectTab = (value: ProposalListTab) => {
    router.setParams({
      tab: value === "all" || !filter.learningRequestId ? "all" : "received",
      status: value === "all" ? undefined : value,
      learningRequestId: value === "all" ? undefined : filter.learningRequestId,
    });
    if (value === "all") {
      setKeyword("");
      setSearchOpen(false);
    }
  };
  return (
    <AppScreenLayout
      title="Đề xuất"
      selected="Tin nhắn"
      back={{ href: "/messages", label: "Quay lại tin nhắn" }}
      rightAction={
        <ProposalSearchButton
          expanded={searchOpen}
          onPress={() => {
            setSearchOpen(!searchOpen);
            setKeyword("");
          }}
        />
      }
    >
      {() => (
        <FlatList
          data={searchProposals(query.items, keyword)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.id}
          contentContainerStyle={[ui.page, { paddingTop: 0 }]}
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching)
              void query.fetchNextPage({ cancelRefetch: false });
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 16 }}>
              {searchOpen && (
                <ProposalSearchField value={keyword} onChange={setKeyword} />
              )}
              <ProposalListFilters value={selectedTab} onChange={selectTab} />
              {filter.learningRequestId && (
                <>
                  <Copy>Đề xuất nhận được cho yêu cầu học đã chọn.</Copy>
                  <Button
                    variant="secondary"
                    onPress={() =>
                      router.setParams({ learningRequestId: undefined })
                    }
                  >
                    Bỏ lọc yêu cầu học
                  </Button>
                </>
              )}
              <ConnectionFeedback
                loading={query.isLoading}
                error={query.error}
                retry={query.refetch}
              />
            </View>
          }
          ListEmptyComponent={
            !query.isPending && !query.error ? (
              <EmptyState
                title={
                  keyword.trim()
                    ? "Chưa thấy đề xuất phù hợp"
                    : "Chưa có đề xuất"
                }
                description={
                  keyword.trim()
                    ? query.hasNextPage
                      ? "Thử từ khóa khác hoặc tải thêm đề xuất bên dưới."
                      : "Thử tìm bằng nội dung khác trong đề xuất."
                    : "Đề xuất ở trạng thái này sẽ xuất hiện tại đây."
                }
                action={keyword.trim() ? "Xóa tìm kiếm" : "Khám phá"}
                onAction={() =>
                  keyword.trim() ? setKeyword("") : router.push("/discover")
                }
              />
            ) : null
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                variant="secondary"
                disabled={query.isFetching}
                onPress={() => {
                  void query.fetchNextPage({ cancelRefetch: false });
                }}
              >
                Tải thêm đề xuất
              </Button>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={{ gap: 8 }}>
              <ApiProposalSummary proposal={item} compact />
              <Button
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/proposal/[id]",
                    params: { id: item.id },
                  })
                }
              >
                Xem đề xuất
              </Button>
            </View>
          )}
        />
      )}
    </AppScreenLayout>
  );
}
