import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "@/components/Avatar";
import { colors, fonts, gradients, radius } from "@/constants/theme";
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
      <LinearGradient
        colors={gradients.discoveryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.row}
      >
        <Avatar name={request.user} size={48} />
        <View style={styles.main}>
          <View style={styles.byline}>
            <Text style={styles.name}>{request.user}</Text>
            <Text style={styles.time}>{request.created}</Text>
          </View>
          <Text style={styles.title}>{request.title}</Text>
          <Text style={styles.skills}>{request.tags.join(" · ")}</Text>
          <View style={styles.footer}>
            <Text style={styles.caption}>{request.sessions} buổi</Text>
            <View style={styles.creditBadge}>
              <Text style={styles.credit}>{request.budget}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    overflow: "hidden",
  },
  row: { padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  main: { flex: 1, minWidth: 0, gap: 7 },
  byline: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 20,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
    includeFontPadding: false,
  },
  skills: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.body,
  },
  credit: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.brand,
    textAlign: "right",
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    includeFontPadding: false,
  },
  creditBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.badge,
    backgroundColor: colors.brandLight,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
});
