import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { colors, fonts, signedInChrome, typography } from "@/constants/theme";
import type { DemoProposal, ProposalStatus } from "../mocks/proposals";

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Đã hết hạn",
};
export function ProposalCard({
  proposal,
  onPress,
}: {
  proposal: DemoProposal;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem đề xuất ${proposal.direction === "sent" ? "gửi đến" : "từ"} ${proposal.partner}, ${proposalStatusLabels[proposal.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.row}>
        <Avatar name={proposal.partner} userId={proposal.partnerId} size={40} />
        <View style={styles.person}>
          <Text style={styles.name}>{proposal.partner}</Text>
          <Text style={styles.caption}>{proposal.time}</Text>
        </View>
        <Text style={styles.credit}>{proposal.credit} CR</Text>
      </View>
      <Text style={styles.label}>
        {proposal.direction === "sent"
          ? "Bạn đề xuất chia sẻ"
          : "Có thể chia sẻ"}{" "}
        {proposal.skill}
      </Text>
      <Text style={styles.body} numberOfLines={2}>
        {proposal.requestTitle}
      </Text>
      <Text style={styles.caption}>
        {proposal.sourceType === "DIRECT_SEARCH"
          ? "Lời mời trực tiếp"
          : "Phản hồi yêu cầu học"}
      </Text>
      <View style={styles.row}>
        <Badge
          label={proposalStatusLabels[proposal.status]}
          variant={
            proposal.status === "ACCEPTED"
              ? "success"
              : proposal.status === "PENDING"
                ? "warning"
                : "default"
          }
        />
        <Text style={styles.caption}>{proposal.sessions} buổi dự kiến</Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: signedInChrome.surface,
    borderRadius: 8,
    padding: 16,
    gap: 10,
    minHeight: 44,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  person: { flex: 1, minWidth: 120, gap: 2 },
  name: { fontFamily: fonts.bold, ...typography.body, color: colors.ink },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.inkSoft,
  },
  body: { fontFamily: fonts.body, ...typography.secondary, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  credit: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.brandHover,
    fontVariant: ["tabular-nums"],
  },
});
