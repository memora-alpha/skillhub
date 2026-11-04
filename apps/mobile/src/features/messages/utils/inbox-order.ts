import type { ApiConversation } from "../api/messages-api";

export function conversationActivityAt(
  conversation: ApiConversation,
  activity?: string,
) {
  let latest = conversation.createdAt;
  for (const candidate of [conversation.lastActivityAt, activity])
    if (candidate && Date.parse(candidate) > Date.parse(latest))
      latest = candidate;
  return latest;
}

export function compareConversationActivity(
  a: ApiConversation,
  b: ApiConversation,
  activityA?: string,
  activityB?: string,
) {
  const difference =
    Date.parse(conversationActivityAt(b, activityB)) -
    Date.parse(conversationActivityAt(a, activityA));
  if (difference || a.id === b.id) return difference;
  return a.id < b.id ? 1 : -1;
}

export function orderConversations(
  conversations: ApiConversation[],
  activity: (id: string) => string | undefined,
) {
  return [...conversations].sort((a, b) =>
    compareConversationActivity(a, b, activity(a.id), activity(b.id)),
  );
}
