import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { useRequestDetail } from "@/features/learning-requests";
import {
  ProposalListCard,
  ReceivedRequestProposals,
} from "@/features/proposals";
import {
  useProposal,
  useSentRequestProposals,
} from "@/features/proposals/state";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { EmptyState } from "@/components/EmptyState";
import { requestMessageRoute } from "../utils/inbox-groups";
import { RequestMessageTabs } from "../components/RequestMessageTabs";
import { RequestChatsContent } from "../components/RequestChatsContent";
import { requestGroupTitle } from "../utils/request-group-title";

export function RequestMessagesScreen() {
  const route = requestMessageRoute(useLocalSearchParams());
  return route ? (
    <RequestMessages key={route.id} route={route} />
  ) : (
    <AppScreenLayout
      title="Yêu cầu học"
      selected="Tin nhắn"
      back={{ href: "/messages", label: "Quay lại tin nhắn" }}
    >
      {() => (
        <EmptyState
          title="Không tìm thấy yêu cầu học"
          description="Kiểm tra lại liên kết hoặc trở về tin nhắn."
        />
      )}
    </AppScreenLayout>
  );
}
function RequestMessages({
  route,
}: Readonly<{ route: NonNullable<ReturnType<typeof requestMessageRoute>> }>) {
  const router = useRouter();
  const request = useRequestDetail(route.id, {
    preferOwnList: true,
    refreshOnFocus: "stale",
  });
  const readable = request.readDenied ? undefined : request.data;
  const { userId } = useConnections();
  const ownRequest = !!readable && !("owner" in readable);
  const publicRequest = !!readable && "owner" in readable;
  const context = useProposal(ownRequest ? "" : (route.proposalId ?? ""));
  const related =
    !context.denied && context.data?.learningRequestId === route.id
      ? context.data
      : undefined;
  const sent = related && related.proposerId === userId ? related : undefined;
  const received = related && related.recipientId === userId;
  const direction =
    ownRequest || received
      ? "received"
      : publicRequest || sent
        ? "sent"
        : "unknown";
  const title = requestGroupTitle(route.id, {
    title: readable?.title,
    denied: !!request.readDenied,
    pending: request.isPending,
  });
  return (
    <AppScreenLayout
      title={title}
      selected="Tin nhắn"
      back={{ href: "/messages", label: "Quay lại tin nhắn" }}
    >
      {() => (
        <View style={styles.content}>
          <RequestMessageTabs
            value={route.view}
            direction={direction}
            onChange={(view) => router.setParams({ view })}
          />
          {route.view === "chats" ? (
            <RequestChatsContent requestId={route.id} title={title} />
          ) : direction === "sent" ? (
            sent ? (
              <View style={styles.notice}>
                <ProposalListCard
                  proposal={sent}
                  compact
                  returnRequestId={route.id}
                />
              </View>
            ) : (
              <SentRequestProposal requestId={route.id} />
            )
          ) : direction === "unknown" &&
            route.proposalId &&
            context.isPending ? (
            <ConnectionFeedback loading />
          ) : (
            <ReceivedRequestProposals
              requestId={route.id}
              status={route.status}
              onStatusChange={(status) => router.setParams({ status })}
              onOpenChats={() => router.setParams({ view: "chats" })}
            />
          )}
        </View>
      )}
    </AppScreenLayout>
  );
}

function SentRequestProposal({ requestId }: Readonly<{ requestId: string }>) {
  const sent = useSentRequestProposals({ refreshOnFocus: "stale" });
  const entry = !sent.denied ? sent.data?.[requestId] : undefined;
  const detail = useProposal(entry?.id ?? "");
  const { userId } = useConnections();
  const proposal =
    !detail.denied &&
    detail.data?.learningRequestId === requestId &&
    detail.data.proposerId === userId
      ? detail.data
      : undefined;
  const loading = sent.isPending || (!!entry && detail.isPending);
  const error = sent.error ?? detail.error;
  return (
    <View style={styles.notice}>
      <ConnectionFeedback
        loading={loading}
        error={error}
        retry={sent.error ? sent.refetch : detail.refetch}
      />
      {proposal ? (
        <ProposalListCard
          proposal={proposal}
          compact
          returnRequestId={requestId}
        />
      ) : !loading && !error ? (
        <EmptyState
          title="Chưa có đề xuất đã gửi cho yêu cầu này"
          description="Đề xuất của bạn sẽ xuất hiện ở đây sau khi gửi."
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1 },
  notice: { padding: 16 },
});
