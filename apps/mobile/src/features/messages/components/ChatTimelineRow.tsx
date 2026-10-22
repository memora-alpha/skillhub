import { Text, View } from "react-native";
import { fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";
import { ApiMessageBubble } from "./ApiMessageBubble";
import { QueuedMessageBubble } from "./QueuedMessageBubble";
import { chatDayLabel, type DatedChatItem } from "../utils/chat-dates";

export function ChatTimelineRow({
  item,
  partner,
  partnerId,
  offline,
  retry,
}: Readonly<{
  item: DatedChatItem;
  partner: string;
  partnerId: string;
  offline: boolean;
  retry(id: string): void;
}>) {
  if (item.kind === "day")
    return (
      <View style={{ alignItems: "center", paddingVertical: 10 }}>
        <Text
          accessibilityRole="header"
          style={{
            ...typography.caption,
            fontFamily: fonts.semibold,
            color: colors.muted,
          }}
        >
          {chatDayLabel(item.date)}
        </Text>
      </View>
    );
  return item.kind === "queued" ? (
    <QueuedMessageBubble
      entry={item.entry}
      showTime={item.showTime}
      offline={offline}
      onRetry={() => retry(item.entry.clientMessageId)}
    />
  ) : (
    <ApiMessageBubble
      message={item.message}
      showTime={item.showTime}
      partner={partner}
      partnerId={partnerId}
    />
  );
}
