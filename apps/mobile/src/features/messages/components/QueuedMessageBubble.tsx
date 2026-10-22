import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { fonts, typography } from "@/constants/theme";
import type { QueuedText } from "../outbox/outbox-types";
import { messageColors as colors } from "../constants/theme";
import { MessageBubble } from "./MessageBubble";
import { chatTime } from "../utils/chat-dates";

function deliveryLabel(entry: QueuedText, offline: boolean) {
  if (entry.state === "failed") return entry.failure ?? "Chưa gửi được";
  if (offline) return "Chờ kết nối";
  return "";
}

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
  const failed = entry.state === "failed";
  const label = deliveryLabel(entry, offline);
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
      {(failed || offline) && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            gap: 5,
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Icon
            name={failed ? "alert" : "clock"}
            size={12}
            color={failed ? colors.brand : colors.muted}
          />
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
      )}
    </View>
  );
}
