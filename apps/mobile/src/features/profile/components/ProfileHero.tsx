import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ProfileAvatarLink } from "@/components/profile-avatar-link";
import { Icon } from "@/components/Icon";
import { typography, avatarSizes, iconSizes, fonts } from "@/constants/theme";
import { profileColors } from "../constants/theme";

export function ProfileHero({
  name,
  userId,
  headline,
  avatarUrl = null,
  selectedTitle,
  onEdit,
  onSettings,
  linkToPublicProfile = false,
}: {
  name: string;
  userId: string;
  headline: string;
  avatarUrl?: string | null;
  selectedTitle?: string | null;
  onEdit?: () => void;
  onSettings?: () => void;
  linkToPublicProfile?: boolean;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        {linkToPublicProfile ? (
          <ProfileAvatarLink
            name={name}
            userId={userId}
            size={avatarSizes.profile}
            sourceUri={avatarUrl}
            href={{ pathname: "/profiles/[userId]", params: { userId } }}
          />
        ) : (
          <Avatar
            name={name}
            userId={userId}
            size={avatarSizes.profile}
            sourceUri={avatarUrl}
          />
        )}
        <View style={styles.actions}>
          {onEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chỉnh sửa hồ sơ"
              onPress={onEdit}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                name="edit"
                size={iconSizes.control}
                color={profileColors.ink}
              />
            </Pressable>
          )}
          {onSettings && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cài đặt tài khoản"
              onPress={onSettings}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                name="settings"
                size={iconSizes.control}
                color={profileColors.ink}
              />
            </Pressable>
          )}
        </View>
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
        {!!selectedTitle && (
          <View style={styles.titleBadge}>
            <Icon
              name="award"
              size={iconSizes.inline}
              color={profileColors.muted}
            />
            <Text style={[styles.tagline, { flexShrink: 1 }]}>
              {selectedTitle}
            </Text>
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
  iconButton: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: profileColors.surface,
    borderWidth: 1,
    borderColor: profileColors.border,
  },
  actions: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  info: { marginTop: 8 },
  titleBadge: {
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
