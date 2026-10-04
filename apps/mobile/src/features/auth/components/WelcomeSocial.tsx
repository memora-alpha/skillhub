import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";

export function WelcomeAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <View style={styles.avatar}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}
export function WelcomeStars({ size = 14 }: { size?: number }) {
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, index) => (
        <Icon key={index} name="star" color={colors.star} size={size} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    includeFontPadding: false,
    fontFamily: fonts.displayBold,
    color: colors.brand,
    fontSize: 12,
  },
  stars: { flexDirection: "row" },
});
