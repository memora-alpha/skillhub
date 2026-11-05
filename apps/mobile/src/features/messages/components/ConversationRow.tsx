import { useIsFocused, useRouter } from "expo-router";
import { useConnections, useParticipantProfile } from "@/features/connections";
import type { InboxConversation } from "../utils/conversation-preview";
import { inboxTime } from "../utils/chat-dates";
import { useConversationContext } from "../hooks/use-conversation-context";
import { ConversationCard } from "./ConversationCard";

export function ConversationRow({
  item,
  compact = false,
  topic,
  visible = true,
}: Readonly<{
  item: InboxConversation;
  compact?: boolean;
  topic?: string;
  visible?: boolean;
}>) {
  const { conversation } = item;
  const active = useIsFocused() && visible;
  const router = useRouter(),
    { userId } = useConnections();
  const partnerId =
    conversation.participantAId === userId
      ? conversation.participantBId
      : conversation.participantAId;
  const profile = useParticipantProfile(partnerId, active);
  const context = useConversationContext(conversation, false, active && !topic);
  const state =
    item.state === "failed"
      ? "Chưa gửi · "
      : item.state === "pending"
        ? "Chờ gửi · "
        : "";
  return (
    <ConversationCard
      name={profile.data?.fullName ?? "Thành viên SkillHub"}
      avatarUrl={profile.data?.avatarUrl}
      userId={partnerId}
      preview={`${state}${item.preview}`}
      time={inboxTime(item.activityAt)}
      topic={topic ?? context.label}
      showTopic={!compact}
      reference={context.reference}
      unread={item.unread ?? false}
      onPress={() =>
        router.push({
          pathname: "/chat/[proposalId]",
          params: { proposalId: conversation.id, mode: "api" },
        })
      }
    />
  );
}
