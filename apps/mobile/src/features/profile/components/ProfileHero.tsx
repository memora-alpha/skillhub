import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import {
  typography,
  avatarSizes,
  iconSizes,
  fonts,
  signedInChrome,
} from "@/constants/theme";
import { VerifiedBadge } from "./ProfilePrimitives";
import { profileDetails } from "../mocks/profile";

export function ProfileHero({
  name,
  userId,
  onEdit,
}: {
  name: string;
  userId: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <Avatar name={name} userId={userId} size={avatarSizes.profile} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa hồ sơ"
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && { opacity: 0.7 }]}
        >
          <Icon name="edit" size={iconSizes.inline} color={signedInChrome.ink} />
          <Text style={styles.editLabel}>Chỉnh sửa</Text>
        </Pressable>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          {profileDetails.verified && <VerifiedBadge />}
        </View>
        <Text style={styles.tagline}>{profileDetails.tagline}</Text>
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
    backgroundColor: signedInChrome.surface,
    borderWidth: 1,
    borderColor: signedInChrome.border,
  },
  editLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: signedInChrome.ink,
    includeFontPadding: false,
  },
  info: { marginTop: 8 },
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
    color: signedInChrome.ink,
    includeFontPadding: false,
  },
  tagline: {
    marginTop: 1,
    fontFamily: fonts.body,
    ...typography.secondary,
    color: "#847E77",
    includeFontPadding: false,
  },
});
