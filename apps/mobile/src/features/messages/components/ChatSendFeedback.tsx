import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { useMessagesApi } from "../hooks/use-messages-api";
import type { useChatOutbox } from "../context/ChatOutbox";

export function ChatSendFeedback({
  id,
  messageId,
  sender,
  readError,
  onReadError,
}: Readonly<{
  id: string;
  messageId?: string;
  sender: ReturnType<typeof useChatOutbox>;
  readError: unknown;
  onReadError: (error: unknown) => void;
}>) {
  const api = useMessagesApi();
  const runtime = useConnections();
  return (
    <>
      <ConnectionFeedback
        error={sender.error ?? (sender.offline ? undefined : readError)}
        retry={
          sender.error
            ? () => {
                void sender.store.start();
              }
            : undefined
        }
      />
      {!!readError && !sender.offline && (
        <Button
          variant="secondary"
          onPress={() => {
            if (!messageId || !runtime.isCurrent()) return;
            void api
              .read(id, messageId)
              .then(() => {
                if (runtime.isCurrent()) onReadError(undefined);
              })
              .catch((error: unknown) => {
                if (runtime.isCurrent()) onReadError(error);
              });
          }}
        >
          Thử xác nhận đã đọc
        </Button>
      )}
      {sender.offline && (
        <Copy muted>Đang ngoại tuyến · Tin nhắn sẽ gửi khi có mạng.</Copy>
      )}
    </>
  );
}
