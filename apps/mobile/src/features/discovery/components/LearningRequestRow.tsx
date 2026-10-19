import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { avatarSizes, iconSizes, typography, fonts } from "@/constants/theme";
import { discoveryColors as colors } from "../constants/theme";
import type { LearningRequest } from "../mocks/requests";

export function LearningRequestRow({
  request,
  onPress,
}: {
  request: LearningRequest;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem yêu cầu: ${request.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.byline}>
        <Avatar
          name={request.user}
          userId={request.userId}
          size={avatarSizes.list}
        />
        <View style={styles.person}>
          <Text style={styles.name}>{request.user}</Text>
          <Text style={styles.time}>Mới đăng · {request.created}</Text>
        </View>
        <View style={styles.status}>
          <Text style={styles.statusLabel}>Đang mở</Text>
        </View>
      </View>
      <Text style={styles.title}>{request.title}</Text>
      <View style={styles.tags}>
        {request.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagLabel}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <View style={styles.budget}>
          <View style={styles.sessions}>
            <Icon
              name="calendar"
              size={iconSizes.inline}
              color={colors.muted}
            />
            <Text style={styles.caption}>{request.sessions} buổi học</Text>
          </View>
          <Text style={styles.credit}>{request.budget}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.detailsLabel}>Xem chi tiết</Text>
          <Icon name="chevron" size={iconSizes.inline} color={colors.orange} />
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 3px 12px rgba(53, 43, 31, 0.04)",
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  person: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.ink,
    includeFontPadding: false,
  },
  time: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    includeFontPadding: false,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: colors.tag,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagLabel: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.muted,
  },
  credit: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: colors.orange,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
    includeFontPadding: false,
  },
  status: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.greenSoft,
  },
  statusLabel: {
    fontFamily: fonts.bold,
    ...typography.caption,
    color: colors.green,
  },
  budget: { flex: 1, minWidth: 0, gap: 2 },
  sessions: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FFE3D5",
    backgroundColor: colors.orangeSoft,
    borderRadius: 6,
  },
  detailsLabel: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: colors.orange,
  },
});
