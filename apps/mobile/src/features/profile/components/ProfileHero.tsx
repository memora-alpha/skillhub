import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { colors, fonts, radius } from "@/constants/theme";
import { VerifiedBadge } from "./ProfilePrimitives";
import { profileDetails } from "../mocks/profile";

export function ProfileHero({
  name,
  onEdit,
}: {
  name: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <Avatar name={name} size={64} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa hồ sơ"
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && { opacity: 0.7 }]}
        >
          <Icon name="edit" size={14} color={colors.ink} />
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
    paddingVertical: 8,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
  editLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  info: { marginTop: 16 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.ink,
    includeFontPadding: false,
  },
  tagline: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    includeFontPadding: false,
  },
});
