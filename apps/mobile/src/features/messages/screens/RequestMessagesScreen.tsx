import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { useRequestDetail } from "@/features/learning-requests";
import { ReceivedRequestProposals } from "@/features/proposals";
import { useProposal } from "@/features/proposals/state";
import { useGroupedInbox } from "../hooks/use-messages-api";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { EmptyState } from "@/components/EmptyState";
import { requestMessageRoute } from "../utils/inbox-groups";
import { RequestMessageTabs } from "../components/RequestMessageTabs";
import { RequestChatsContent } from "../components/RequestChatsContent";
import { requestGroupTitle } from "../utils/request-group-title";

export function RequestMessagesScreen() {
  const params = useLocalSearchParams();
  const route = requestMessageRoute(params);
  return route ? (
    <RequestMessages
      key={route.id}
      route={route}
      explicitStatus={params.status !== undefined}
    />
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
  explicitStatus,
}: Readonly<{
  route: NonNullable<ReturnType<typeof requestMessageRoute>>;
  explicitStatus: boolean;
}>) {
  const router = useRouter();
  const inbox = useGroupedInbox(false);
  const group = inbox.items.find(
    (item) =>
      item.groupType === "LEARNING_REQUEST" &&
      item.learningRequestId === route.id,
  );
  const request = useRequestDetail(group ? undefined : route.id, {
    preferOwnList: true,
    refreshOnFocus: "stale",
  });
  const readable = request.readDenied ? undefined : request.data;
  const { userId } = useConnections();
  const ownRequest = !!readable && !("owner" in readable);
  const publicRequest = !!readable && "owner" in readable;
  const context = useProposal(
    group || ownRequest ? "" : (route.proposalId ?? ""),
  );
  const related =
    !context.denied && context.data?.learningRequestId === route.id
      ? context.data
      : undefined;
  const sent = related && related.proposerId === userId ? related : undefined;
  const received = related && related.recipientId === userId;
  const direction = group
    ? group.viewerRole === "OWNER"
      ? "received"
      : group.viewerRole === "PROPOSER"
        ? "sent"
        : "unknown"
    : ownRequest || received
      ? "received"
      : publicRequest || sent
        ? "sent"
        : "unknown";
  const title = requestGroupTitle(route.id, {
    title:
      group?.title ??
      readable?.title ??
      related?.learningRequestTitle ??
      undefined,
    denied: !group && !related?.learningRequestTitle && !!request.readDenied,
    pending: !group && request.isPending,
  });
  const rolePending =
    request.isPending || (!!route.proposalId && context.isPending);
  const roleError =
    (!request.readDenied && request.error) ||
    (!context.denied && context.error);
  const openChats = () => router.setParams({ view: "chats" });
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
          ) : group?.viewerRole === "PARTICIPANT" ? (
            <View style={styles.notice}>
              <EmptyState
                title="Không có đề xuất của bạn cho yêu cầu này"
                description="Bạn vẫn có thể xem các cuộc trò chuyện của mình."
              />
            </View>
          ) : direction === "unknown" ? (
            <View style={styles.notice}>
              {rolePending || roleError ? (
                <ConnectionFeedback
                  loading={rolePending}
                  error={roleError}
                  retry={
                    request.error === roleError
                      ? request.refetch
                      : context.refetch
                  }
                />
              ) : (
                <EmptyState
                  title="Chưa xác định được đề xuất cho yêu cầu này"
                  description="Bạn có thể mở Đoạn chat để xem các cuộc trò chuyện của mình."
                  action="Mở đoạn chat"
                  onAction={openChats}
                />
              )}
            </View>
          ) : (
            <ReceivedRequestProposals
              requestId={route.id}
              direction={direction}
              status={
                direction === "sent" && !explicitStatus ? "all" : route.status
              }
              onStatusChange={(status) => router.setParams({ status })}
              onOpenChats={openChats}
            />
          )}
        </View>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  notice: { padding: 16 },
});
