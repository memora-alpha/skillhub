import { View } from "react-native";
import { Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { useConfirmedFormShare } from "../hooks/use-confirmed-form-share";

export function ConfirmedFormFeedback({
  conversationId,
}: Readonly<{ conversationId: string }>) {
  const sender = useConfirmedFormShare();
  const pending = sender.pending.filter(
    (v) => v.conversationId === conversationId,
  );
  if (!pending.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {pending.map((item) => (
        <View key={item.clientMessageId} style={{ gap: 6 }}>
          <Copy muted>
            {item.state === "sending"
              ? "Đang gửi form đã xác nhận vào Chat…"
              : item.state === "processing"
                ? "Xác nhận đã lưu. Thẻ Chat đang được xử lý."
                : "Xác nhận đã lưu, nhưng chưa gửi được thẻ vào Chat."}
          </Copy>
          {item.state !== "sending" && (
            <Button
              variant="secondary"
              onPress={() => {
                void sender.check(item);
              }}
            >
              Kiểm tra lần gửi thẻ
            </Button>
          )}
          {item.state === "failed" && (
            <Button
              variant="secondary"
              onPress={() => {
                void sender.retry(item);
              }}
            >
              Gửi lại thẻ đã xác nhận
            </Button>
          )}
        </View>
      ))}
    </View>
  );
}
