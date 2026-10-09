import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { typography, avatarSizes, iconSizes, fonts } from "@/constants/theme";
import { profileColors } from "../constants/theme";

export function ProfileHero({
  name,
  userId,
  headline,
  avatarUrl = null,
  onEdit,
}: {
  name: string;
  userId: string;
  headline: string;
  avatarUrl?: string | null;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <Avatar
          name={name}
          userId={userId}
          size={avatarSizes.profile}
          sourceUri={avatarUrl}
        />
        {onEdit && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ"
            onPress={onEdit}
            style={({ pressed }) => [styles.edit, pressed && { opacity: 0.7 }]}
          >
            <Icon
              name="edit"
              size={iconSizes.inline}
              color={profileColors.ink}
            />
            <Text style={styles.editLabel}>Chỉnh sửa</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
        </View>
        {!!headline.trim() && (
          <Text selectable style={styles.tagline}>
            {headline}
          </Text>
        )}
        {onEdit && (
          <View style={styles.titlePlaceholder}>
            <Icon
              name="award"
              size={iconSizes.inline}
              color={profileColors.muted}
            />
            <Text style={styles.tagline}>Danh hiệu · Sắp có</Text>
          </View>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 2,
    paddingTop: 1,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 9,
    minHeight: 36,
    borderRadius: 13,
    backgroundColor: profileColors.surface,
    borderWidth: 1,
    borderColor: profileColors.border,
  },
  editLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: profileColors.ink,
    includeFontPadding: false,
  },
  info: { marginTop: 8 },
  titlePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    ...typography.title,
    color: profileColors.ink,
    includeFontPadding: false,
  },
  tagline: {
    marginTop: 1,
    fontFamily: fonts.body,
    ...typography.secondary,
    color: profileColors.muted,
    includeFontPadding: false,
  },
});
