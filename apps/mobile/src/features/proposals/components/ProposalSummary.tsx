import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { colors, fonts, signedInChrome, typography } from "@/constants/theme";
import { proposalStatusLabels } from "./ProposalCard";
import type { DemoProposal } from "../mocks/proposals";

export function ProposalSummary({
  proposal,
  compact = false,
}: {
  proposal: DemoProposal;
  compact?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar name={proposal.partner} userId={proposal.partnerId} size={48} />
        <View style={styles.person}>
          <Text style={styles.name}>{proposal.partner}</Text>
          <Text style={styles.caption}>
            {proposal.direction === "sent" ? "Người nhận" : "Người gửi"} ·{" "}
            {proposal.time}
          </Text>
        </View>
      </View>
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
      <Text style={styles.heading}>{proposal.requestTitle}</Text>
      <Text style={styles.caption}>
        {proposal.sourceType === "DIRECT_SEARCH"
          ? "Lời mời trực tiếp từ hồ sơ"
          : "Phản hồi yêu cầu học"}{" "}
        · {proposal.skill}
      </Text>
      {!compact && (
        <>
          <Text selectable style={styles.body}>
            {proposal.message}
          </Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.caption}>Credit gợi ý</Text>
              <Text style={styles.credit}>{proposal.credit} CR</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.caption}>Số buổi dự kiến</Text>
              <Text style={styles.name}>{proposal.sessions} buổi</Text>
            </View>
          </View>
          <Text style={styles.caption}>Khung giờ tham khảo</Text>
          <Text selectable style={styles.body}>
            {proposal.schedule || "Chưa đề xuất khung giờ"}
          </Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: signedInChrome.surface,
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  person: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.bold, ...typography.body, color: colors.ink },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: colors.cream,
    padding: 12,
    borderRadius: 6,
    gap: 4,
  },
  credit: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.brandHover,
  },
});
