import { useConversation } from "@/features/messages";
import { useConnections, useParticipantProfile } from "@/features/connections";
import { notificationTarget } from "../utils/notification-target";
import type { InboxNotification } from "../api/notifications-api";

export function useNotificationSender(item: InboxNotification) {
  const { userId } = useConnections();
  const target = notificationTarget(item);
  const id =
    item.type === "chat.message.delivered" &&
    target &&
    typeof target === "object" &&
    "params" in target &&
    target.params &&
    "proposalId" in target.params
      ? String(target.params.proposalId)
      : "";
  const conversation = useConversation(id);
  const data = conversation.data;
  const partnerId =
    data && userId && data.participantAId === userId
      ? data.participantBId
      : data && userId && data.participantBId === userId
        ? data.participantAId
        : undefined;
  const profile = useParticipantProfile(partnerId);
  return profile.data?.fullName.trim() || undefined;
}
