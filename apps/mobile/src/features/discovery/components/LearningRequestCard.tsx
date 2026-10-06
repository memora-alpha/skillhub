import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { colors, fonts } from "@/constants/theme";
import type { LearningRequest } from "../mocks/requests";

export function LearningRequestCard({
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
      <View style={styles.top}>
        <View style={styles.main}>
          <Text style={styles.title}>{request.title}</Text>
          <View style={styles.tags}>
            {request.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </View>
        </View>
        <View style={styles.budget}>
          <Text style={styles.credit}>{request.budget}</Text>
          <Text style={styles.caption}>{request.sessions} buổi</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.user}>
          <Avatar name={request.user} size={24} />
          <Text style={[styles.caption, { flexShrink: 1 }]}>
            {request.user}
          </Text>
        </View>
        <Text style={[styles.caption, { color: colors.mutedLight }]}>
          {request.created}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    gap: 12,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  main: { flex: 1, minWidth: 0, gap: 8 },
  title: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 19.25,
    color: colors.ink,
    includeFontPadding: false,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  budget: { alignItems: "flex-end", maxWidth: "40%", gap: 2 },
  credit: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
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
  footer: {
    borderTopWidth: 1,
    borderColor: colors.sand,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  user: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
});
