import type { ApiConversation } from "../api/messages-api";

export function orderConversations(
  conversations: ApiConversation[],
  activity: (id: string) => string | undefined,
) {
  const timestamp = (value: string) => {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  };
  return [...conversations].sort(
    (a, b) =>
      Math.max(timestamp(b.createdAt), timestamp(activity(b.id) ?? "")) -
      Math.max(timestamp(a.createdAt), timestamp(activity(a.id) ?? "")),
  );
}
