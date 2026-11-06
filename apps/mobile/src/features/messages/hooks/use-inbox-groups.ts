import { useCallback } from "react";
import { useIsFocused } from "expo-router";
import { useConnections } from "@/features/connections";
import { useConversationInbox } from "./use-conversation-inbox";
import { useGroupedInbox } from "./use-messages-api";
import { inboxGroups } from "../utils/inbox-groups";
import { orderInboxGroups } from "../utils/inbox-order";
import type { ApiConversation, ApiInboxGroup } from "../api/messages-api";

export function useInboxGroups(
  visibleIds: ReadonlySet<string>,
  groupType?: ApiInboxGroup["groupType"],
) {
  const focused = useIsFocused();
  const { userId } = useConnections();
  const inbox = useGroupedInbox(focused);
  // The server cursor covers both types; keep its pagination while filtering rows.
  const items = inbox.items.filter(
    (group) => !groupType || group.groupType === groupType,
  );
  const hasVisibleChats = items.some(
    (group) => group.conversationCount > 0 && visibleIds.has(group.id),
  );
  const shouldLoadPreview = useCallback(
    (conversation: ApiConversation) => {
      const type = conversation.learningRequestId
        ? "LEARNING_REQUEST"
        : "DIRECT_CONVERSATION";
      return (
        (!groupType || type === groupType) &&
        visibleIds.has(
          conversation.learningRequestId
            ? `request:${conversation.learningRequestId}`
            : `conversation:${conversation.id}`,
        )
      );
    },
    [visibleIds, groupType],
  );
  const previews = useConversationInbox({
    enabled: hasVisibleChats,
    previewLimit: 20,
    shouldLoadPreview,
  });
  const byId = new Map(
    inboxGroups(previews.items, [], userId ?? "").map((group) => [
      `${group.kind}:${group.id}`,
      group,
    ]),
  );
  const previewFor = (group: ApiInboxGroup) =>
    byId.get(
      group.groupType === "LEARNING_REQUEST"
        ? group.id
        : `direct:${group.conversationId}`,
    );
  const groups = orderInboxGroups(items, (group) => {
    const preview = previewFor(group);
    const latest =
      preview?.kind === "request" ? preview.latestConversation : preview?.item;
    return latest?.state ? undefined : latest?.activityAt;
  });
  return {
    ...inbox,
    items: groups.map((group) => ({
      group,
      preview: previewFor(group),
    })),
    hasNextPage: inbox.hasNextPage && !inbox.denied,
    refetch: () =>
      Promise.all([
        inbox.refetch({ cancelRefetch: false }),
        hasVisibleChats ? previews.refetch() : undefined,
      ]),
    loadMore: () => inbox.fetchNextPage({ cancelRefetch: false }),
  };
}
