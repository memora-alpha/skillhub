import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Copy } from "@/components/feature-page";
import { useProposalList } from "../hooks/use-proposals-api";
import { ProposalList } from "../components/ProposalList";
import {
  ProposalListFilters,
  type ProposalListTab,
} from "../components/ProposalListFilters";
import {
  ProposalSearchButton,
  ProposalSearchField,
} from "../components/ProposalSearch";
import { proposalListFilter } from "../utils/proposal-route";
import { ProposalUnavailable } from "../components/ProposalUnavailable";
function emptyDescription(searching: boolean, hasMore: boolean) {
  if (!searching) return "Đề xuất ở trạng thái này sẽ xuất hiện tại đây.";
  return hasMore
    ? "Thử từ khóa khác hoặc tải thêm đề xuất bên dưới."
    : "Thử tìm bằng nội dung khác trong đề xuất.";
}

export function ApiProposalsScreen() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const params = useLocalSearchParams();
  const filter = proposalListFilter({
    ...params,
    tab: params.tab ?? "received",
  });
  const direction = filter?.direction ?? "all",
    status = filter?.status;
  const query = useProposalList(
    direction,
    status,
    filter?.learningRequestId,
    !!filter,
  );
  if (!filter) return <ProposalUnavailable />;
  const selectedTab = status ?? "all";
  const selectTab = (value: ProposalListTab) => {
    router.setParams({
      status: value === "all" ? undefined : value,
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
        <ProposalList
          query={query}
          keyword={keyword}
          header={
            <>
              {searchOpen && (
                <ProposalSearchField value={keyword} onChange={setKeyword} />
              )}
              <ProposalListFilters
                value={selectedTab}
                onChange={selectTab}
                direction={direction}
                onDirectionChange={(tab) => {
                  router.setParams({ tab, learningRequestId: undefined });
                  setKeyword("");
                }}
              />
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
            </>
          }
          empty={
            <EmptyState
              title={
                keyword.trim() ? "Chưa thấy đề xuất phù hợp" : "Chưa có đề xuất"
              }
              description={emptyDescription(
                !!keyword.trim(),
                !!query.hasNextPage,
              )}
              action={keyword.trim() ? "Xóa tìm kiếm" : "Khám phá"}
              onAction={() =>
                keyword.trim() ? setKeyword("") : router.push("/discover")
              }
            />
          }
        />
      )}
    </AppScreenLayout>
  );
}
