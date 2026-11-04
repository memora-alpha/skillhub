import type { ApiConversation, ApiInboxGroup } from "../api/messages-api";

function timestamp(value?: string) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

export function orderConversations(
  conversations: ApiConversation[],
  activity: (id: string) => string | undefined,
) {
  return [...conversations].sort(
    (a, b) =>
      Math.max(timestamp(b.createdAt), timestamp(activity(b.id))) -
      Math.max(timestamp(a.createdAt), timestamp(activity(a.id))),
  );
}

export function orderInboxGroups(
  groups: ApiInboxGroup[],
  messageActivity: (group: ApiInboxGroup) => string | undefined,
) {
  return groups
    .map((group) => ({
      group,
      activity: Math.max(
        timestamp(group.lastActivityAt),
        timestamp(messageActivity(group)),
      ),
    }))
    .sort((a, b) => b.activity - a.activity)
    .map(({ group }) => group);
}
