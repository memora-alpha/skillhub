import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors, fonts } from "@/constants/theme";
import type { ChatMessage } from "../mocks/chat";

export function MessageBubble({
  message,
  partner,
}: {
  message: ChatMessage;
  partner: string;
}) {
  const { width } = useWindowDimensions();
  const mine = message.from === "me";
  return (
    <View style={[styles.row, mine && { justifyContent: "flex-end" }]}>
      {!mine && <Avatar name={partner} size={24} />}
      <View
        style={[
          styles.bubble,
          { maxWidth: width >= 768 ? "65%" : "78%" },
          mine ? styles.mine : styles.theirs,
        ]}
      >
        <Text selectable style={[styles.text, mine && { color: colors.white }]}>
          {message.text}
        </Text>
        <Text style={[styles.time, mine && { color: "#FFFFFFB3" }]}>
          {message.time}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
    minWidth: 0,
  },
  mine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  theirs: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22.75,
    color: colors.ink,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.mutedLight,
  },
});
