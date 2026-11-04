import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  useConnections,
  useParticipantProfile,
  useCatalogName,
} from "@/features/connections";
import type { Proposal } from "../api/proposals-api";
import { proposalStatusLabels } from "../constants/proposal-status";

function DetailRow({
  icon,
  label,
  value,
}: Readonly<{
  icon: "book" | "calendar" | "clock" | "wallet";
  label: string;
  value: string;
}>) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon name={icon} size={16} color={colors.muted} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function ApiProposalSummary({
  proposal,
}: Readonly<{ proposal: Proposal }>) {
  const router = useRouter();
  const { userId } = useConnections();
  const sent = proposal.proposerId === userId;
  const partnerId = sent ? proposal.recipientId : proposal.proposerId;
  const partner = useParticipantProfile(partnerId);
  const partnerName = partner.data?.fullName ?? "Thành viên SkillHub";
  const requestTitle = proposal.learningRequestTitle?.trim();
  const skill = useCatalogName(requestTitle ? undefined : proposal.skillId);
  const requestId = proposal.learningRequestId;
  const exchangeLabel =
    proposal.exchangeTypeHint === "TWO_WAY"
      ? "Trao đổi hai chiều"
      : proposal.exchangeTypeHint === "ONE_WAY"
        ? "Học một chiều"
        : undefined;
  const statusVariant =
    proposal.status === "ACCEPTED"
      ? "success"
      : proposal.status === "PENDING"
        ? "warning"
        : "default";
  const credit = proposal.proposedCredit
    ? `${proposal.proposedCredit} Credit`
    : undefined;
  const expiresAt = new Date(proposal.expiresAt);
  const hasDetails =
    exchangeLabel ||
    credit ||
    proposal.initialSessionCount !== null ||
    proposal.proposedDurationMinutes !== null;

  return (
    <View style={styles.card}>
      <View style={styles.topline}>
        <Text accessibilityRole="header" style={styles.subject}>
          {requestTitle || skill.data || "Đề xuất trao đổi"}
        </Text>
        <Badge
          label={proposalStatusLabels[proposal.status]}
          variant={statusVariant}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem hồ sơ ${partnerName}`}
        onPress={() =>
          router.push({
            pathname: "/profiles/[userId]",
            params: { userId: partnerId },
          })
        }
        style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
      >
        <Avatar
          name={partnerName}
          userId={partnerId}
          sourceUri={partner.data?.avatarUrl}
          size={40}
          shape="circle"
        />
        <View style={styles.personText}>
          <Text numberOfLines={1} style={styles.personName}>
            {partnerName}
          </Text>
          <Text style={styles.caption}>
            {sent ? "Người nhận" : "Người gửi"} ·{" "}
            {new Date(proposal.createdAt).toLocaleDateString("vi-VN")}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.muted} />
      </Pressable>

      <View style={styles.messageSection}>
        <Text style={styles.sectionLabel}>Lời nhắn</Text>
        <View style={styles.messageBox}>
          <View style={styles.messageAccent} />
          <Text selectable style={styles.message}>
            {proposal.message}
          </Text>
        </View>
      </View>

      {hasDetails && (
        <View style={styles.details}>
          {exchangeLabel && (
            <DetailRow icon="book" label="Hình thức" value={exchangeLabel} />
          )}
          {credit && (
            <DetailRow icon="wallet" label="Credit gợi ý" value={credit} />
          )}
          {proposal.initialSessionCount !== null && (
            <DetailRow
              icon="calendar"
              label="Số buổi dự kiến"
              value={`${proposal.initialSessionCount} buổi`}
            />
          )}
          {proposal.proposedDurationMinutes !== null && (
            <DetailRow
              icon="clock"
              label="Thời lượng"
              value={`${proposal.proposedDurationMinutes} phút`}
            />
          )}
        </View>
      )}

      {!!proposal.candidateSlots && (
        <View style={styles.availability}>
          <View style={styles.availabilityHeading}>
            <Icon name="calendar" size={16} color={colors.info} />
            <Text style={styles.availabilityLabel}>Lịch rảnh gợi ý</Text>
          </View>
          <Text selectable style={styles.availabilityText}>
            {proposal.candidateSlots}
          </Text>
        </View>
      )}

      {proposal.status === "PENDING" && (
        <Text style={styles.caption}>
          Hết hạn {expiresAt.toLocaleString("vi-VN")}
        </Text>
      )}
      {requestId && (
        <Button
          variant="paper"
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/request/[id]",
              params: { id: requestId },
            })
          }
        >
          Xem yêu cầu học
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
  },
  topline: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  subject: {
    flex: 1,
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  pressed: { opacity: 0.72 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  personText: { flex: 1, minWidth: 0, gap: 3 },
  personName: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  caption: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  messageSection: { gap: 8 },
  sectionLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  messageBox: {
    flexDirection: "row",
    gap: 11,
    padding: 13,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  messageAccent: {
    width: 3,
    borderRadius: appRadius.full,
    backgroundColor: colors.primary,
  },
  message: {
    flex: 1,
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.body,
  },
  details: { gap: 2 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 5,
  },
  detailIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLow,
    borderRadius: appRadius.control,
  },
  detailText: { flex: 1, gap: 1 },
  detailLabel: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  detailValue: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  availability: {
    gap: 7,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.infoSoft,
  },
  availabilityHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  availabilityLabel: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.info,
  },
  availabilityText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
});
