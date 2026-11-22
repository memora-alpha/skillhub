import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { colors, fonts, typography } from "@/constants/theme";
import type { QueuedText } from "../outbox/outbox-types";
import { messageColors } from "../constants/theme";
import { MessageBubble } from "./MessageBubble";
import { chatTime } from "../utils/chat-dates";
import { chatSendNotice } from "../utils/chat-send-notice";

export function QueuedMessageBubble({
  entry,
  offline,
  onRetry,
  showTime = true,
}: Readonly<{
  entry: QueuedText;
  offline: boolean;
  onRetry: () => void;
  showTime?: boolean;
}>) {
  const notice = chatSendNotice(entry, offline);
  const rejected = notice?.tone === "blocked";
  const failed = rejected || notice?.tone === "failed";
  const foreground = failed ? colors.error : messageColors.muted;
  return (
    <View style={{ gap: 4 }}>
      <MessageBubble
        partner=""
        partnerId=""
        showTime={showTime}
        message={{
          id: entry.clientMessageId,
          from: "me",
          text: entry.messageText,
          time: chatTime(entry.createdAt),
        }}
      />
      {notice && (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole={failed ? "alert" : undefined}
          style={[styles.notice, rejected && styles.rejected]}
        >
          <View style={styles.row}>
            {failed && <Icon name="alert" size={12} color={foreground} />}
            <View style={styles.copy}>
              <Text style={[styles.title, { color: foreground }]}>
                {notice.title}
              </Text>
              {notice.detail && (
                <Text style={styles.detail}>{notice.detail}</Text>
              )}
            </View>
          </View>
          {!rejected && entry.state === "failed" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi lại tin nhắn"
              onPress={onRetry}
              style={styles.action}
            >
              <Text style={styles.actionText}>Thử lại</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { alignSelf: "flex-end", maxWidth: "90%", gap: 2 },
  rejected: {
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  copy: { flexShrink: 1, gap: 3 },
  title: { ...typography.secondary, fontFamily: fonts.semibold },
  detail: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: messageColors.inkSoft,
  },
  action: {
    alignSelf: "flex-end",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  actionText: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.error,
  },
});
