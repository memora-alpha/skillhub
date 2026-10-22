import { Pressable, Text, View, StyleSheet } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useParticipantProfile } from "@/features/connections";
import {
  appColors as colors,
  appRadius,
  fonts,
  signedInChrome,
  typography,
} from "@/constants/theme";
import { uiLabel } from "@/constants/ui-copy";
import { useSkillName } from "../hooks/use-requests";
import {
  isOwnRequest,
  requestState,
  statusLabels,
} from "../utils/request-policy";
import type { RequestItem } from "../types";
import {
  sentRequestProposalLabels,
  type SentRequestProposal,
} from "@/features/proposals/state";

function createdLabel(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60_000),
  );
  if (minutes < 1) return "Vừa tạo";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)} giờ trước`;
  if (minutes < 10_080) return `${Math.floor(minutes / 1_440)} ngày trước`;
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
export function RequestCard({
  request,
  onPress,
  proposal,
}: Readonly<{
  request: RequestItem;
  onPress: () => void;
  proposal?: SentRequestProposal;
}>) {
  const own = isOwnRequest(request);
  const profile = useParticipantProfile(own ? undefined : request.owner.id);
  const skill = useSkillName(own ? request.skillId : undefined);
  const state = requestState(request);
  const skillName = own ? skill.data?.name : request.skill.name;
  const tags = [
    ...new Set(
      [
        skillName,
        request.currentLevel ? uiLabel(request.currentLevel) : undefined,
        ...(!own ? request.tags.map((tag) => tag.label) : []),
      ].filter((label): label is string => !!label),
    ),
  ].slice(0, 3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem yêu cầu: ${request.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.between}>
        {own ? (
          <Text style={[styles.caption, styles.identity]}>
            {createdLabel(request.createdAt)}
          </Text>
        ) : (
          <View style={[styles.row, styles.identity]}>
            <Avatar
              name={request.owner.displayName}
              userId={request.owner.id}
              sourceUri={profile.data?.avatarUrl}
              shape="circle"
              size={36}
            />
            <View style={styles.identityText}>
              <Text numberOfLines={1} style={styles.name}>
                {request.owner.displayName}
              </Text>
              <Text style={styles.caption}>
                {createdLabel(request.createdAt)}
              </Text>
            </View>
          </View>
        )}
        <View
          style={[
            styles.status,
            state === "OPEN" && styles.openStatus,
            state === "PENDING_MODERATION" && styles.pendingStatus,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              state === "OPEN" && styles.openText,
              state === "PENDING_MODERATION" && styles.pendingText,
            ]}
          >
            {statusLabels[state]}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {request.title}
      </Text>
      {!!tags.length && (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text numberOfLines={1} style={styles.tagText}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!own && proposal && (
        <View style={[styles.row, styles.proposalStatus]}>
          <Icon
            name={proposal.status === "ACCEPTED" ? "check-circle" : "send"}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.proposalLabel}>
            {sentRequestProposalLabels[proposal.status]}
          </Text>
        </View>
      )}
      <View style={[styles.between, styles.footer]}>
        <View style={styles.identity}>
          <Text style={styles.credit}>
            {request.desiredCreditPerHour ? (
              <>
                {new Intl.NumberFormat("vi-VN", {
                  maximumFractionDigits: 2,
                }).format(Number(request.desiredCreditPerHour))}{" "}
                CR
                <Text style={styles.caption}> / giờ</Text>
              </>
            ) : (
              "Chưa đặt Credit"
            )}
          </Text>
        </View>
        <View style={styles.detailLink}>
          <Text style={styles.link}>Xem chi tiết</Text>
          <Icon name="chevron" size={14} color={signedInChrome.accent} />
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  proposalStatus: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: appRadius.control,
    backgroundColor: colors.primarySoft,
  },
  proposalLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
    flex: 1,
  },
  card: {
    padding: 14,
    borderRadius: appRadius.card,
    gap: 10,
    borderWidth: 1,
    borderColor: signedInChrome.border,
    backgroundColor: signedInChrome.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  identity: { flex: 1, minWidth: 0 },
  identityText: { flex: 1, gap: 2 },
  name: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: signedInChrome.ink,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: signedInChrome.ink,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceLow,
    maxWidth: "44%",
  },
  openStatus: { backgroundColor: colors.forestSoft },
  pendingStatus: { backgroundColor: colors.primarySoft },
  statusText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.body,
  },
  openText: { color: colors.forest },
  pendingText: { color: colors.primaryDark },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: appRadius.badge,
    backgroundColor: colors.surfaceLow,
    maxWidth: "100%",
  },
  tagText: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.body,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: signedInChrome.border,
    flexWrap: "wrap",
  },
  credit: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: signedInChrome.accent,
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
  },
  link: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: signedInChrome.accent,
  },
});
