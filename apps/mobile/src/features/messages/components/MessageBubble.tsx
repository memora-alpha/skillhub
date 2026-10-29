import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { avatarSizes, typography, fonts } from "@/constants/theme";
import type { MessageBubbleModel } from "../api/messages-api";
import { messageCardShadow, messageColors as colors } from "../constants/theme";

export function MessageBubble({
  message,
  partner,
  partnerId,
  avatarUrl,
  showTime = false,
  showAvatar = true,
  children,
}: {
  message: MessageBubbleModel;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  showTime?: boolean;
  showAvatar?: boolean;
  children?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const mine = message.from === "me";
  let bubbleWidth: ViewStyle["maxWidth"] = mine ? "82%" : "70%";
  if (width >= 768) bubbleWidth = "62%";
  return (
    <View style={styles.message}>
      <View style={[styles.row, mine && styles.mineRow]}>
        {!mine &&
          (showAvatar ? (
            <Avatar
              name={partner}
              userId={partnerId}
              sourceUri={avatarUrl}
              size={avatarSizes.inline}
            />
          ) : (
            <View style={{ width: avatarSizes.inline }} />
          ))}
        <View
          style={[
            styles.bubble,
            { maxWidth: bubbleWidth },
            mine ? styles.mine : styles.theirs,
            !!children && styles.withFile,
            !!children && { minWidth: Math.min(240, Math.max(0, width - 80)) },
            !!children && !message.text.trim() && styles.fileOnly,
          ]}
        >
          {(!!message.text.trim() || !!message.file) && (
            <Text
              selectable
              accessibilityHint={`Gửi lúc ${message.time}`}
              style={[styles.text, mine && { color: colors.white }]}
            >
              {message.text}
              {message.file
                ? `\n${(message.file.bytes / 1024 / 1024).toFixed(1)} MB · tệp mẫu, không có đường dẫn tải`
                : ""}
            </Text>
          )}
          {children}
        </View>
      </View>
      {showTime && (
        <Text style={[styles.time, mine ? styles.myTime : styles.theirTime]}>
          {message.time}
        </Text>
      )}
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
  withFile: { gap: 8 },
  fileOnly: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
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
