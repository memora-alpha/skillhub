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
  const skill = useCatalogName(proposal.skillId);
  const exchangeLabel =
    proposal.exchangeTypeHint === "TWO_WAY"
      ? "Trao đổi hai chiều"
      : proposal.exchangeTypeHint === "ONE_WAY"
        ? "Học một chiều"
        : "Chưa gợi ý hình thức";
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

  return (
    <View style={styles.card}>
      <View style={styles.topline}>
        <View style={styles.skillLine}>
          <View style={styles.skillBadge}>
            <Text numberOfLines={1} style={styles.skillText}>
              {skill.data ?? "Đề xuất trao đổi"}
            </Text>
          </View>
          <Text style={styles.reference}>
            #{proposal.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <Badge
          label={proposalStatusLabels[proposal.status]}
          variant={statusVariant}
        />
      </View>

      <View style={styles.separator} />

      <View style={styles.personRow}>
        <Avatar
          name={partner.data?.fullName ?? "Thành viên SkillHub"}
          userId={partnerId}
          sourceUri={partner.data?.avatarUrl}
          size={48}
          shape="circle"
        />
        <View style={styles.personText}>
          <Text numberOfLines={1} style={styles.personName}>
            {partner.data?.fullName ?? "Thành viên SkillHub"}
          </Text>
          <Text style={styles.caption}>
            {sent ? "Bạn đã gửi đề xuất" : "Đề xuất gửi cho bạn"} ·{" "}
            {new Date(proposal.createdAt).toLocaleDateString("vi-VN")}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.muted} />
      </View>

      <View style={styles.messageSection}>
        <Text style={styles.sectionLabel}>NỘI DUNG PHẢN HỒI</Text>
        <View style={styles.messageBox}>
          <View style={styles.messageAccent} />
          <Text selectable style={styles.message}>
            {proposal.message}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <DetailRow icon="book" label="Hình thức gợi ý" value={exchangeLabel} />
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
            label="Thời lượng mỗi buổi"
            value={`${proposal.proposedDurationMinutes} phút`}
          />
        )}
      </View>

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

      <View style={styles.expiry}>
        <Icon name="clock" size={15} color={colors.amber} />
        <Text style={styles.expiryText}>
          Hết hạn {expiresAt.toLocaleString("vi-VN")}
        </Text>
      </View>

      <View style={styles.links}>
        {proposal.learningRequestId && (
          <Button
            variant="paper"
            style={styles.linkButton}
            onPress={() =>
              router.push({
                pathname: "/request/[id]",
                params: { id: proposal.learningRequestId! },
              })
            }
          >
            <Icon name="book" size={16} color={colors.body} />
            <Text style={styles.linkText}>Xem yêu cầu học</Text>
          </Button>
        )}
        <Button
          variant="paper"
          style={styles.linkButton}
          onPress={() =>
            router.push({
              pathname: "/profiles/[userId]",
              params: { userId: partnerId },
            })
          }
        >
          <Icon name="user" size={16} color={colors.body} />
          <Text style={styles.linkText}>Xem hồ sơ</Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  skillLine: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  skillBadge: {
    maxWidth: "70%",
    borderRadius: appRadius.full,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: colors.primarySoft,
  },
  skillText: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.primaryDark,
  },
  reference: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  separator: { height: 1, backgroundColor: colors.border },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  personText: { flex: 1, minWidth: 0, gap: 3 },
  personName: {
    ...typography.heading,
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
    ...typography.caption,
    fontFamily: fonts.bold,
    letterSpacing: 0.7,
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
    paddingVertical: 8,
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
  expiry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: appRadius.control,
    backgroundColor: colors.amberSoft,
  },
  expiryText: {
    flex: 1,
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  links: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkButton: {
    justifyContent: "center",
    minHeight: 42,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  linkText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
});
