import { useIsFocused } from "expo-router";
import { useConnections } from "@/features/connections";
import { useConversationInbox } from "./use-conversation-inbox";
import { useGroupedInbox } from "./use-messages-api";
import { inboxGroups } from "../utils/inbox-groups";
import { orderInboxGroups } from "../utils/inbox-order";
import type { ApiInboxGroup } from "../api/messages-api";

export function useInboxGroups() {
  const focused = useIsFocused();
  const { userId } = useConnections();
  const inbox = useGroupedInbox(focused);
  const previews = useConversationInbox({
    enabled: inbox.items.length > 0,
    previewLimit: 20,
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
  const groups = orderInboxGroups(inbox.items, (group) => {
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
        inbox.refetch(),
        inbox.items.length ? previews.refetch() : undefined,
      ]),
    loadMore: () => inbox.fetchNextPage({ cancelRefetch: false }),
  };
}
