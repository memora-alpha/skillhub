import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { avatarSizes, typography, fonts } from "@/constants/theme";
import type { ChatMessage } from "../mocks/chat";
import { messageCardShadow, messageColors as colors } from "../constants/theme";

export function MessageBubble({
  message,
  partner,
  partnerId,
}: {
  message: ChatMessage;
  partner: string;
  partnerId: string;
}) {
  const { width } = useWindowDimensions();
  const mine = message.from === "me";
  let bubbleWidth: ViewStyle["maxWidth"] = mine ? "82%" : "70%";
  if (width >= 768) bubbleWidth = "62%";
  return (
    <View style={styles.message}>
      <View style={[styles.row, mine && styles.mineRow]}>
        {!mine && (
          <Avatar name={partner} userId={partnerId} size={avatarSizes.inline} />
        )}
        <View
          style={[
            styles.bubble,
            { maxWidth: bubbleWidth },
            mine ? styles.mine : styles.theirs,
          ]}
        >
          <Text selectable style={[styles.text, mine && { color: colors.white }]}>
            {message.text}
          </Text>
        </View>
      </View>
      <Text style={[styles.time, mine ? styles.myTime : styles.theirTime]}>
        {message.time}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  message: { gap: 2 },
  mineRow: { justifyContent: "flex-end" },
  bubble: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 0,
  },
  mine: { backgroundColor: colors.orange, borderBottomRightRadius: 3 },
  theirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 3,
    boxShadow: messageCardShadow,
  },
  text: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.ink,
  },
  time: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.mutedLight,
  },
  myTime: { color: colors.muted, textAlign: "right" },
  theirTime: { marginLeft: avatarSizes.inline + 8 },
});
