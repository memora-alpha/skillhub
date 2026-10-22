import { StyleSheet, Text, View } from "react-native";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

export function ConversationTopic({
  label,
  reference,
}: Readonly<{ label: string; reference: string }>) {
  return (
    <View style={styles.row}>
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      <Text style={styles.reference}>{reference}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    backgroundColor: appColors.surfaceLow,
    borderRadius: appRadius.control,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    flex: 1,
    minWidth: 0,
  },
  reference: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
    flexShrink: 0,
    fontVariant: ["tabular-nums"],
  },
});
