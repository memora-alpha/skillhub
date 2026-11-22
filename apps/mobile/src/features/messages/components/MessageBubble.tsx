import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import {
  avatarSizes,
  typography,
  fonts,
  colors as palette,
} from "@/constants/theme";
import type { MessageBubbleModel } from "../api/messages-api";
import { messageCardShadow, messageColors as colors } from "../constants/theme";

export function MessageBubble({
  message,
  partner,
  partnerId,
  avatarUrl,
  showTime = false,
  showAvatar = true,
  failed = false,
  children,
}: {
  message: MessageBubbleModel;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  showTime?: boolean;
  showAvatar?: boolean;
  failed?: boolean;
  children?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const mine = message.from === "me";
  let bubbleWidth: ViewStyle["maxWidth"] = mine ? "82%" : "70%";
  if (width >= 768) bubbleWidth = "62%";
  return (
    <View style={styles.message}>
      <View
        style={[
          styles.row,
          mine && styles.mineRow,
          mine && failed && styles.failedSpacing,
        ]}
      >
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
          {!!message.text.trim() && (
            <Text
              selectable
              accessibilityHint={`Gửi lúc ${message.time}`}
              style={[styles.text, mine && { color: colors.white }]}
            >
              {message.text}
            </Text>
          )}
          {children}
        </View>
        {mine && failed && (
          <View
            accessible={false}
            accessibilityElementsHidden
            pointerEvents="none"
            style={styles.failure}
          >
            <Icon name="alert-circle" size={16} color={palette.error} />
          </View>
        )}
      </View>
      {showTime && (
        <View
          style={[
            styles.metadata,
            mine ? styles.myMetadata : styles.theirMetadata,
            mine && failed && styles.failedSpacing,
          ]}
        >
          <Text style={[styles.time, mine && styles.myTime]}>
            {message.time}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  message: { gap: 2 },
  mineRow: { justifyContent: "flex-end" },
  failedSpacing: { paddingRight: 22 },
  failure: { position: "absolute", right: 0, bottom: 6 },
  metadata: { flexDirection: "row", alignItems: "center", gap: 5 },
  myMetadata: { justifyContent: "flex-end" },
  theirMetadata: { marginLeft: avatarSizes.inline + 8 },
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
  myTime: { color: colors.muted },
});
