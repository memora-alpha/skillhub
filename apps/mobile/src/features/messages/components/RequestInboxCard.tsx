import { Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { useRequestDetail } from "@/features/learning-requests";
import {
  useConnections,
  useParticipantProfile,
  useCatalogName,
} from "@/features/connections";
import { useProposal } from "@/features/proposals/state";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import type { RequestInboxGroup } from "../utils/inbox-groups";
import { inboxCount } from "../utils/inbox-groups";
import { messageColors as colors } from "../constants/theme";
import { requestGroupTitle } from "../utils/request-group-title";
import { conversationReference } from "../api/conversation-context";

export function RequestInboxCard({
  group,
  deferTitleRead = false,
}: Readonly<{ group: RequestInboxGroup; deferTitleRead?: boolean }>) {
  const router = useRouter();
  const focused = useIsFocused();
  const { userId } = useConnections();
  const request = useRequestDetail(group.id, {
    active: focused,
    preferOwnList: true,
    waitForOwnList: deferTitleRead,
    refreshOnFocus: "stale",
  });
  const fallback = !!request.readDenied && !request.isPending && focused;
  const proposal = useProposal(
    fallback && !group.skillId ? (group.contextProposalId ?? "") : "",
  );
  const relatedProposal =
    !proposal.denied && proposal.data?.learningRequestId === group.id
      ? proposal.data
      : undefined;
  const fallbackSkillId = group.skillId ?? relatedProposal?.skillId;
  const skill = useCatalogName(fallback ? fallbackSkillId : undefined);
  const latest = group.latestConversation;
  const senderId = latest?.previewSenderId;
  const otherSender =
    senderId !== userId &&
    [
      latest?.conversation.participantAId,
      latest?.conversation.participantBId,
    ].includes(senderId)
      ? senderId
      : undefined;
  const sender = useParticipantProfile(otherSender, focused);
  const shortName =
    otherSender && sender.data?.userId === otherSender
      ? sender.data.fullName.trim().split(/\s+/).at(-1)
      : undefined;
  const preview = shortName ? `${shortName}: ${group.preview}` : group.preview;
  const readable = request.readDenied ? undefined : request.data;
  const publicRequest = !!readable && "owner" in readable;
  const sent =
    (publicRequest && group.hasChat) ||
    (!!relatedProposal && relatedProposal.proposerId === userId);
  const received =
    group.receivedCount > 0 ||
    (!!readable && !publicRequest) ||
    (!!relatedProposal && relatedProposal.recipientId === userId);
  const chatSummary = `${inboxCount(group.chatCount, group.chatCountExact)} đoạn chat`;
  const summary = sent
    ? `Đã gửi đề xuất · ${chatSummary}`
    : received
      ? `${inboxCount(group.receivedCount, group.receivedCountExact)} đề xuất nhận được · ${chatSummary}`
      : chatSummary;
  const title = requestGroupTitle(group.id, {
    title: request.data?.title,
    denied: !!request.readDenied,
    pending: request.isPending,
    skillName: skill.data,
    inlineReference: false,
  });
  const reference =
    !request.readDenied && request.data?.title.trim()
      ? undefined
      : conversationReference(group.id);
  const view =
    group.hasChat && (!group.hasPending || sent) ? "chats" : "received";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${reference ? `, ${reference}` : ""}, ${summary}, ${preview}${group.unread ? ", có tin nhắn chưa đọc" : ""}`}
      onPress={() =>
        router.push({
          pathname: "/messages/request/[id]",
          params: {
            id: group.id,
            view,
            ...(group.contextProposalId
              ? { proposalId: group.contextProposalId }
              : {}),
          },
        })
      }
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.72 }]}
    >
      <View style={styles.icon}>
        <Icon name="file" size={20} color={colors.orange} />
      </View>
      <View style={styles.main}>
        <View style={styles.row}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {reference && <Text style={styles.reference}>{reference}</Text>}
          {group.unread && <View style={styles.dot} />}
        </View>
        <Text style={styles.summary}>{summary}</Text>
        <Text numberOfLines={1} style={styles.preview}>
          {preview}
        </Text>
      </View>
      <Icon name="chevron" size={14} color={colors.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.control,
    backgroundColor: colors.orangeSoft,
  },
  main: { flex: 1, minWidth: 0, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
    flex: 1,
  },
  preview: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  summary: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  reference: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.muted,
    flexShrink: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: appRadius.full,
    backgroundColor: colors.orange,
  },
});
