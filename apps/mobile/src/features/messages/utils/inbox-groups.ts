import type { Href } from "expo-router";
import { z } from "zod";
import { uuid } from "@/lib/http/contracts";
import type { Proposal } from "@/features/proposals/state";
import type { ApiConversation } from "../api/messages-api";
import type { InboxConversation } from "./conversation-preview";

export type RequestInboxGroup = {
  kind: "request";
  id: string;
  activityAt: string;
  preview: string;
  unread: boolean;
  hasPending: boolean;
  hasChat: boolean;
  receivedCount: number;
  pendingCount: number;
  chatCount: number;
  receivedCountExact: boolean;
  chatCountExact: boolean;
  latestConversation?: InboxConversation;
  skillId?: string;
  contextProposalId?: string;
};
export type InboxGroup =
  | RequestInboxGroup
  | {
      kind: "direct";
      id: string;
      activityAt: string;
      item: InboxConversation;
    };

type InboxCoverage = Readonly<{ received: boolean; chats: boolean }>;
const completeCoverage: InboxCoverage = { received: true, chats: true };

function requestGroup(
  requests: Map<string, RequestInboxGroup>,
  id: string,
  activityAt: string,
  preview: string,
  coverage: InboxCoverage,
) {
  let group = requests.get(id);
  if (!group) {
    group = {
      kind: "request",
      id,
      activityAt,
      preview,
      unread: false,
      hasPending: false,
      hasChat: false,
      receivedCount: 0,
      pendingCount: 0,
      chatCount: 0,
      receivedCountExact: coverage.received,
      chatCountExact: coverage.chats,
    };
    requests.set(id, group);
  } else if (Date.parse(activityAt) > Date.parse(group.activityAt)) {
    group.activityAt = activityAt;
    group.preview = preview;
  }
  return group;
}

function proposalPreview(status: Proposal["status"]) {
  if (status === "PENDING") return "Có đề xuất đang chờ phản hồi";
  if (status === "REJECTED") return "Đề xuất đã từ chối";
  return "Lịch sử đề xuất";
}

function chatPreview(item: InboxConversation) {
  if (item.state === "failed") return `Chưa gửi · ${item.preview}`;
  if (item.state === "pending") return `Chờ gửi · ${item.preview}`;
  return item.preview;
}

function addConversation(
  requests: Map<string, RequestInboxGroup>,
  direct: InboxGroup[],
  item: InboxConversation,
  userId: string,
  coverage: InboxCoverage,
) {
  const conversation = item.conversation;
  if (
    ![conversation.participantAId, conversation.participantBId].includes(userId)
  )
    return;
  if (!conversation.learningRequestId) {
    direct.push({
      kind: "direct",
      id: conversation.id,
      activityAt: item.activityAt,
      item,
    });
    return;
  }
  const group = requestGroup(
    requests,
    conversation.learningRequestId,
    item.activityAt,
    chatPreview(item),
    coverage,
  );
  group.hasChat = true;
  group.contextProposalId ??= conversation.proposalId;
  group.unread ||= !!item.unread;
  group.chatCount++;
  if (
    !group.latestConversation ||
    Date.parse(item.activityAt) >
      Date.parse(group.latestConversation.activityAt)
  )
    group.latestConversation = item;
}

export function inboxGroups(
  conversations: InboxConversation[],
  proposals: Proposal[],
  userId: string,
  coverage: InboxCoverage = completeCoverage,
): InboxGroup[] {
  const requests = new Map<string, RequestInboxGroup>();
  const direct: InboxGroup[] = [];
  for (const proposal of new Map(proposals.map((p) => [p.id, p])).values()) {
    if (proposal.recipientId !== userId || !proposal.learningRequestId)
      continue;
    const group = requestGroup(
      requests,
      proposal.learningRequestId,
      proposal.updatedAt,
      proposalPreview(proposal.status),
      coverage,
    );
    group.hasPending ||= proposal.status === "PENDING";
    group.receivedCount++;
    group.skillId ??= proposal.skillId;
    group.contextProposalId ??= proposal.id;
    if (proposal.status === "PENDING") group.pendingCount++;
  }
  for (const item of new Map(
    conversations.map((c) => [c.conversation.id, c]),
  ).values()) {
    addConversation(requests, direct, item, userId, coverage);
  }
  for (const group of requests.values()) {
    const latest = group.latestConversation;
    if (!latest) continue;
    group.preview = chatPreview(latest);
  }
  return [...requests.values(), ...direct].sort(
    (a, b) =>
      Date.parse(b.activityAt) - Date.parse(a.activityAt) ||
      a.id.localeCompare(b.id),
  );
}

export function inboxCount(count: number, exact: boolean) {
  if (exact) return String(count);
  return count ? `${count}+` : "…";
}

const requestRoute = z.object({
  id: uuid,
  view: z.enum(["received", "chats"]).optional(),
  proposalId: uuid.optional(),
  status: z
    .enum(["all", "PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"])
    .optional(),
});
export function requestMessageRoute(value: unknown) {
  const parsed = requestRoute.safeParse(value);
  return parsed.success
    ? {
        id: parsed.data.id,
        view: parsed.data.view ?? "received",
        status: parsed.data.status ?? "PENDING",
        ...(parsed.data.proposalId
          ? { proposalId: parsed.data.proposalId }
          : {}),
      }
    : null;
}

export function chatInboxRoute(
  conversation: Pick<ApiConversation, "learningRequestId"> &
    Partial<Pick<ApiConversation, "proposalId">>,
): Href {
  return conversation.learningRequestId
    ? {
        pathname: "/messages/request/[id]",
        params: {
          id: conversation.learningRequestId,
          view: "chats",
          ...(conversation.proposalId
            ? { proposalId: conversation.proposalId }
            : {}),
        },
      }
    : "/messages";
}
