import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, typography } from "@/constants/theme";
import type { QueuedText } from "../outbox/outbox-types";
import { messageColors } from "../constants/theme";
import { MessageBubble } from "./MessageBubble";
import { chatTime } from "../utils/chat-dates";
import { chatSendNotice } from "../utils/chat-send-notice";
import { isFinalAttachmentFailure } from "../outbox/attachment-errors";
import { ChatFileCard } from "./ChatFileCard";
import { ChatImageCard } from "./ChatImageCard";
import { chatAttachmentNoun, isChatImage } from "../utils/chat-attachment-kind";

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
  const retryDisabled = !!entry.attachment && offline;
  const foreground = failed ? colors.error : messageColors.muted;
  return (
    <View style={{ gap: 4 }}>
      <MessageBubble
        partner=""
        partnerId=""
        showTime={showTime}
        failed={failed}
        message={{
          id: entry.clientMessageId,
          from: "me",
          text: entry.messageText,
          time: chatTime(entry.createdAt),
        }}
      >
        {entry.attachment &&
          (isChatImage(entry.attachment.mimeType) ? (
            <ChatImageCard
              filename={entry.attachment.name}
              uri={entry.attachment.uri}
              status={
                entry.state === "failed" &&
                (entry.failureCode === "CONTENT_MODERATION_BLOCKED" ||
                  entry.failureCode === "CHAT_FILE_BLOCKED" ||
                  entry.failureCode === "CHAT_FILE_REJECTED" ||
                  entry.failureCode === "CHAT_FILE_REVOKED" ||
                  entry.failureCode === "CHAT_FILE_REMOTE_UNAVAILABLE" ||
                  entry.failureCode === "CHAT_FILE_DELETED")
                  ? "unavailable"
                  : undefined
              }
            />
          ) : (
            <ChatFileCard
              mine
              filename={entry.attachment.name}
              mimeType={entry.attachment.mimeType}
              bytes={entry.attachment.size}
            />
          ))}
      </MessageBubble>
      {notice && (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole={failed ? "alert" : undefined}
          accessibilityLabel={
            failed ? `${notice.title}. ${notice.detail ?? ""}` : undefined
          }
          style={[styles.notice, failed && styles.failedNotice]}
        >
          <View style={[styles.copy, failed && styles.failedCopy]}>
            {failed ? (
              <Text style={styles.detail}>{notice.detail}</Text>
            ) : (
              <Text style={[styles.title, { color: foreground }]}>
                {notice.title}
              </Text>
            )}
          </View>
          {!rejected &&
            !isFinalAttachmentFailure(entry.failureCode) &&
            entry.state === "failed" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  entry.attachment
                    ? `Thử gửi lại ${chatAttachmentNoun(entry.attachment.mimeType)}`
                    : "Gửi lại tin nhắn"
                }
                accessibilityHint={
                  retryDisabled ? "Kết nối mạng để thử lại" : undefined
                }
                accessibilityState={{ disabled: retryDisabled }}
                disabled={retryDisabled}
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                  retryDisabled && styles.disabled,
                ]}
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
  failedNotice: {
    marginRight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  copy: { flexShrink: 1, minWidth: 0 },
  failedCopy: {
    backgroundColor: colors.errorLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  title: { ...typography.secondary, fontFamily: fonts.semibold },
  detail: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
  },
  action: {
    alignSelf: "center",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  actionText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
});
