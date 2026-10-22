import { View } from "react-native";
import { Copy } from "@/components/feature-page";
import type { ChatTimelineItem } from "../utils/chat-timeline";
import { messageGrouping } from "../utils/message-grouping";
import { ApiMessageBubble } from "./ApiMessageBubble";
import { QueuedMessageBubble } from "./QueuedMessageBubble";

function groupMessage(item: ChatTimelineItem, userId: string) {
  return item.kind === "message"
    ? item.message
    : {
        senderId: userId,
        sentAt: item.entry.createdAt,
        messageType: "TEXT",
      };
}

export function ChatThreadMessage({
  item,
  older,
  newer,
  partner,
  partnerId,
  avatarUrl,
  seen,
  userId,
  offline,
  retry,
}: Readonly<{
  item: ChatTimelineItem;
  older?: ChatTimelineItem;
  newer?: ChatTimelineItem;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  seen: boolean;
  userId: string;
  offline: boolean;
  retry: (id: string) => void;
}>) {
  const message = groupMessage(item, userId);
  const group = messageGrouping(
    message,
    older && groupMessage(older, userId),
    newer && groupMessage(newer, userId),
  );
  const date = new Date(message.sentAt);
  return (
    <View style={{ gap: 8, paddingTop: group.startsGroup ? 12 : 3 }}>
      {!!group.timestamp && (
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Copy muted>
            {group.timestamp === "day"
              ? `${date.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "numeric",
                })} · `
              : ""}
            {date.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Copy>
        </View>
      )}
      {item.kind === "queued" ? (
        <QueuedMessageBubble
          entry={item.entry}
          offline={offline}
          showTime={false}
          onRetry={() => retry(item.entry.clientMessageId)}
        />
      ) : (
        <ApiMessageBubble
          message={item.message}
          partner={partner}
          partnerId={partnerId}
          avatarUrl={avatarUrl}
          showReadReceipt={seen}
          showAvatar={group.showAvatar}
        />
      )}
    </View>
  );
}
