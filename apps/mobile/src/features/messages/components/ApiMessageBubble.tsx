import { useState } from "react";
import { View } from "react-native";
import { openURL } from "expo-linking";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { useConnections, connectionError } from "@/features/connections";
import { useMessagesApi } from "../hooks/use-messages-api";
import type { ApiMessage } from "../api/messages-api";
import { MessageBubble } from "./MessageBubble";
import { chatTime } from "../utils/chat-dates";

export function ApiMessageBubble({
  message,
  partner,
  partnerId,
  showTime = true,
}: Readonly<{
  message: ApiMessage;
  partner: string;
  partnerId: string;
  showTime?: boolean;
}>) {
  const { userId, isCurrent } = useConnections(),
    api = useMessagesApi();
  const [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const download = async (attachmentId: string) => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await api.download(
        message.conversationId,
        message.id,
        attachmentId,
      );
      if (isCurrent() && Date.parse(result.expiresAt) > Date.now())
        await openURL(result.url);
    } catch (error_) {
      if (isCurrent()) setError(error_);
    } finally {
      if (isCurrent()) setPending(false);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      {message.messageType === "SYSTEM" ? (
        <FormNotice tone="info">
          {message.messageText || "Cập nhật từ hệ thống"}
        </FormNotice>
      ) : (
        <MessageBubble
          partner={partner}
          partnerId={partnerId}
          showTime={showTime}
          message={{
            id: message.id,
            from: message.senderId === userId ? "me" : "them",
            text: message.messageText,
            time: chatTime(message.sentAt),
          }}
        />
      )}
      {message.attachments.map((file) => (
        <Button
          key={file.attachmentId}
          variant="secondary"
          disabled={pending}
          onPress={() => {
            void download(file.attachmentId);
          }}
        >
          {file.filename} · {(file.fileSizeBytes / 1000000).toFixed(1)} MB
        </Button>
      ))}
      {message.senderId === userId && message.readAt && (
        <Copy muted>Đã đọc · {chatTime(message.readAt)}</Copy>
      )}
      {!!error && (
        <FormNotice tone="error">{connectionError(error)}</FormNotice>
      )}
    </View>
  );
}
