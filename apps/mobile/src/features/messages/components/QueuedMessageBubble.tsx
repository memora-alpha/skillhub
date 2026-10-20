import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { fonts, typography } from "@/constants/theme";
import type { QueuedText } from "../outbox/outbox-types";
import { messageColors as colors } from "../constants/theme";
import { MessageBubble } from "./MessageBubble";
import { chatTime } from "../utils/chat-dates";

export function QueuedMessageBubble({
  entry,
  offline,
  onRetry,
  showTime = true,
}: {
  entry: QueuedText;
  offline: boolean;
  onRetry: () => void;
  showTime?: boolean;
}) {
  const failed = entry.state === "failed";
  const label = failed
    ? (entry.failure ?? "Chưa gửi được")
    : offline
      ? "Chờ kết nối"
      : entry.state === "queued"
        ? "Chờ gửi"
        : "Đang gửi";
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
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          gap: 5,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {failed ? (
          <Icon name="alert" size={12} color={colors.brand} />
        ) : offline ? (
          <Icon name="clock" size={12} color={colors.muted} />
        ) : (
          <ActivityIndicator
            size="small"
            color={colors.muted}
            accessibilityLabel="Tin nhắn đang gửi"
          />
        )}
        <Text
          style={{
            ...typography.caption,
            fontFamily: fonts.body,
            color: colors.muted,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {failed && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi lại tin nhắn"
            onPress={onRetry}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 6,
            }}
          >
            <Text
              style={{
                ...typography.caption,
                fontFamily: fonts.semibold,
                color: colors.brand,
              }}
            >
              Thử lại
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
