import { View, StyleSheet } from "react-native";
import { useIsFocused } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { AppError } from "@/lib/http/errors";
import { useProposalList } from "../hooks/use-proposals-api";
import { ProposalList } from "./ProposalList";
import {
  ProposalListFilters,
  type ProposalListTab,
} from "./ProposalListFilters";
import {
  isTransientReadError,
  useQuietReadRecovery,
} from "@/lib/query/use-quiet-read-recovery";

export function ReceivedRequestProposals({
  requestId,
  status,
  onStatusChange,
  onOpenChats,
  direction = "received",
}: Readonly<{
  requestId: string;
  status: ProposalListTab;
  onStatusChange: (status: ProposalListTab) => void;
  onOpenChats: () => void;
  direction?: "received" | "sent";
}>) {
  const focused = useIsFocused();
  const query = useProposalList(
    direction,
    status === "all" ? undefined : status,
    requestId,
    focused,
  );
  const quiet = isTransientReadError(query.error);
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: focused,
    retry: () =>
      query.isFetchNextPageError
        ? query.fetchNextPage({ cancelRefetch: false })
        : query.refetch(),
  });
  if (query.error instanceof AppError && query.error.status === 404) {
    return (
      <View style={styles.notice}>
        <EmptyState
          title="Yêu cầu học này không còn khả dụng"
          description="Bạn có thể mở tab Đoạn chat để xem cuộc trò chuyện của mình."
          action="Mở đoạn chat"
          onAction={onOpenChats}
        />
      </View>
    );
  }
  return (
    <ProposalList
      query={query}
      requestId={requestId}
      quiet={quiet}
      compactHeader={direction === "sent"}
      header={
        <ProposalListFilters
          statusOnly
          value={status}
          onChange={onStatusChange}
          direction={direction}
          onDirectionChange={() => {}}
        />
      }
      empty={
        <EmptyState
          title={
            direction === "sent" && status === "all"
              ? "Chưa có đề xuất đã gửi cho yêu cầu này"
              : status === "PENDING"
                ? "Chưa có đề xuất chờ phản hồi"
                : "Không có đề xuất ở trạng thái này"
          }
          description="Chọn trạng thái khác để xem các đề xuất đã xử lý."
          action={status === "all" ? undefined : "Xem tất cả"}
          onAction={() => onStatusChange("all")}
        />
      }
    />
  );
}

const styles = StyleSheet.create({ notice: { padding: 16 } });
