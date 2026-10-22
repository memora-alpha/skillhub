import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import {
  useCatalogName,
  useConnections,
  useParticipantProfile,
} from "@/features/connections";
import type { Proposal } from "../api/proposals-api";
import { proposalStatusLabels } from "../constants/proposal-status";

export function ProposalListCard({
  proposal,
}: Readonly<{ proposal: Proposal }>) {
  const router = useRouter();
  const { userId } = useConnections();
  const sent = proposal.proposerId === userId;
  const partnerId = sent ? proposal.recipientId : proposal.proposerId;
  const partner = useParticipantProfile(partnerId);
  const skill = useCatalogName(proposal.skillId);
  const name = partner.data?.fullName ?? "Thành viên SkillHub";
  const detail = (closeAction?: "withdraw") =>
    router.push({
      pathname: "/proposal/[id]",
      params: { id: proposal.id, ...(closeAction ? { closeAction } : {}) },
    });
  const accepted = proposal.status === "ACCEPTED";
  const pending = proposal.status === "PENDING";
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.source}>
          {proposal.sourceType === "LEARNING_REQUEST"
            ? "Phản hồi yêu cầu học"
            : "Lời mời trực tiếp"}
        </Text>
        {proposal.exchangeTypeHint && (
          <Text style={styles.hint}>
            {proposal.exchangeTypeHint === "TWO_WAY"
              ? "Gợi ý hai chiều"
              : "Gợi ý một chiều"}
          </Text>
        )}
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {skill.data ?? "Đề xuất trao đổi"}
      </Text>
      <View style={styles.personRow}>
        <Avatar
          name={name}
          userId={partnerId}
          sourceUri={partner.data?.avatarUrl}
          size={40}
        />
        <View style={styles.identity}>
          <Text numberOfLines={2} style={styles.name}>
            {name}
          </Text>
          <Text style={styles.caption}>
            {sent ? "Bạn đã gửi" : "Gửi cho bạn"} ·{" "}
            {new Date(proposal.createdAt).toLocaleDateString("vi-VN")}
          </Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <Badge
          label={proposalStatusLabels[proposal.status]}
          variant={accepted ? "success" : pending ? "warning" : "default"}
        />
        <Text style={styles.caption}>Bản {proposal.version}</Text>
      </View>
      <View style={styles.message}>
        <Text numberOfLines={3} style={styles.body}>
          {proposal.message}
        </Text>
      </View>
      {proposal.proposedCredit !== null && (
        <View style={styles.credit}>
          <Icon name="wallet" size={16} color={colors.muted} />
          <Text style={styles.caption}>
            Credit gợi ý:{" "}
            <Text style={styles.creditValue}>{proposal.proposedCredit}</Text>
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        {sent && pending && (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => detail("withdraw")}
            style={styles.action}
          >
            Rút đề xuất
          </Button>
        )}
        <Button
          variant={accepted || sent ? "secondary" : "primary"}
          size="sm"
          onPress={() => detail()}
          style={styles.action}
        >
          {pending && !sent ? "Xem và phản hồi" : "Chi tiết"}
        </Button>
        {accepted && proposal.conversationId && (
          <Button
            size="sm"
            leadingIcon="message"
            style={styles.action}
            onPress={() =>
              router.push({
                pathname: "/chat/[proposalId]",
                params: { proposalId: proposal.conversationId!, mode: "api" },
              })
            }
          >
            Nhắn tin
          </Button>
        )}
        {accepted && !proposal.conversationId && (
          <Button
            size="sm"
            leadingIcon="message"
            style={styles.action}
            onPress={() => router.push("/messages")}
          >
            Tin nhắn
          </Button>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: appRadius.card,
    padding: 16,
    gap: 12,
  },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  source: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hint: { ...typography.caption, fontFamily: fonts.body, color: colors.muted },
  title: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  name: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  message: {
    backgroundColor: colors.surfaceLow,
    borderRadius: appRadius.control,
    padding: 12,
  },
  body: { ...typography.body, fontFamily: fonts.body, color: colors.body },
  credit: { flexDirection: "row", alignItems: "center", gap: 6 },
  creditValue: { fontFamily: fonts.semibold, color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flexGrow: 1, flexBasis: 100, minHeight: 44 },
});
