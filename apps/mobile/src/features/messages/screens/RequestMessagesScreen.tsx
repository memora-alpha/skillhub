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

type RequestRoute = NonNullable<ReturnType<typeof requestMessageRoute>>;
type ProposalDirection = "received" | "sent" | "unknown";

function proposalDirection(
  viewerRole: "OWNER" | "PROPOSER" | "PARTICIPANT" | undefined,
  received: boolean,
  sent: boolean,
): ProposalDirection {
  if (viewerRole === "OWNER") return "received";
  if (viewerRole === "PROPOSER") return "sent";
  if (viewerRole === "PARTICIPANT") return "unknown";
  if (received) return "received";
  if (sent) return "sent";
  return "unknown";
}

function roleFeedback(
  request: ReturnType<typeof useRequestDetail>,
  context: ReturnType<typeof useProposal>,
  hasProposal: boolean,
) {
  const pending = request.isPending || (hasProposal && context.isPending);
  const error =
    (!request.readDenied && request.error) ||
    (!context.denied && context.error);
  const retry = request.error === error ? request.refetch : context.refetch;
  return { pending, error, retry };
}

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
  route: RequestRoute;
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
  const direction = proposalDirection(
    group?.viewerRole,
    ownRequest || !!received,
    publicRequest || !!sent,
  );
  const title = requestGroupTitle(route.id, {
    title:
      group?.title ??
      readable?.title ??
      related?.learningRequestTitle ??
      undefined,
    denied: !group && !related?.learningRequestTitle && !!request.readDenied,
    pending: !group && request.isPending,
  });
  const feedback = roleFeedback(request, context, !!route.proposalId);
  const openChats = () => router.setParams({ view: "chats" });
  const status = direction === "sent" && !explicitStatus ? "all" : route.status;
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
          ) : (
            <RequestProposalContent
              route={route}
              direction={direction}
              participant={group?.viewerRole === "PARTICIPANT"}
              pending={feedback.pending}
              error={feedback.error}
              retry={feedback.retry}
              status={status}
              onStatusChange={(status) => router.setParams({ status })}
              onOpenChats={openChats}
            />
          )}
        </View>
      )}
    </AppScreenLayout>
  );
}

function RequestProposalContent({
  route,
  direction,
  participant,
  pending,
  error,
  retry,
  status,
  onStatusChange,
  onOpenChats,
}: Readonly<{
  route: RequestRoute;
  direction: ProposalDirection;
  participant: boolean;
  pending: boolean;
  error: unknown;
  retry: () => unknown;
  status: RequestRoute["status"];
  onStatusChange: (status: RequestRoute["status"]) => void;
  onOpenChats: () => void;
}>) {
  if (participant)
    return (
      <View style={styles.notice}>
        <EmptyState
          title="Không có đề xuất của bạn cho yêu cầu này"
          description="Bạn vẫn có thể xem các cuộc trò chuyện của mình."
        />
      </View>
    );
  if (direction === "unknown")
    return (
      <View style={styles.notice}>
        {pending || error ? (
          <ConnectionFeedback loading={pending} error={error} retry={retry} />
        ) : (
          <EmptyState
            title="Chưa xác định được đề xuất cho yêu cầu này"
            description="Bạn có thể mở Đoạn chat để xem các cuộc trò chuyện của mình."
            action="Mở đoạn chat"
            onAction={onOpenChats}
          />
        )}
      </View>
    );
  return (
    <ReceivedRequestProposals
      requestId={route.id}
      direction={direction}
      status={status}
      onStatusChange={onStatusChange}
      onOpenChats={onOpenChats}
    />
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  notice: { padding: 16 },
});
