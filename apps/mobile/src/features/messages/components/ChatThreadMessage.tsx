import { View } from "react-native";
import { Copy } from "@/components/feature-page";
import type { ApiMessage } from "../api/messages-api";
import { messageGrouping } from "../utils/message-grouping";
import { ApiMessageBubble } from "./ApiMessageBubble";

export function ChatThreadMessage({
  message,
  older,
  newer,
  partner,
  partnerId,
  avatarUrl,
  seen,
}: Readonly<{
  message: ApiMessage;
  older?: ApiMessage;
  newer?: ApiMessage;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  seen: boolean;
}>) {
  const group = messageGrouping(message, older, newer);
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
      <ApiMessageBubble
        message={message}
        partner={partner}
        partnerId={partnerId}
        avatarUrl={avatarUrl}
        showReadReceipt={seen}
        showAvatar={group.showAvatar}
      />
    </View>
  );
}
