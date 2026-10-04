import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
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
    <LinearGradient
      colors={[colors.ink, colors.inkSoft]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.top}>
        <Avatar name={name} size={96} ring />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa hồ sơ"
          onPress={onEdit}
          style={({ pressed }) => [
            styles.edit,
            pressed && { backgroundColor: "#FFFFFF33" },
          ]}
        >
          <Icon name="edit" size={14} color={colors.white} />
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
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -16,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 64,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF33",
    backgroundColor: "#FFFFFF1A",
  },
  editLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
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
    color: colors.white,
    includeFontPadding: false,
  },
  tagline: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFFB3",
    includeFontPadding: false,
  },
});
