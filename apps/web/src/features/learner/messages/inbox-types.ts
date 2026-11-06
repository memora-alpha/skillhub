export type InboxGroup = {
  id: string;
  groupType: string;
  learningRequestId: string | null;
  conversationId: string | null;
  title: string | null;
  viewerRole: string;
  receivedProposalCount: number | null;
  sentProposalCount: number | null;
  conversationCount: number;
  hasUnread: boolean;
  latestMessage: {
    conversationId: string;
    senderId: string;
    preview: string;
    sentAt: string;
    messageType: string;
  } | null;
};

export function inboxGroupSummary(group: InboxGroup) {
  const chats = `${group.conversationCount} đoạn chat`;
  if (group.viewerRole === "OWNER" && group.receivedProposalCount !== null)
    return `${group.receivedProposalCount} đề nghị nhận được · ${chats}`;
  if (group.viewerRole === "PROPOSER") return `Đã gửi đề nghị · ${chats}`;
  return chats;
}
