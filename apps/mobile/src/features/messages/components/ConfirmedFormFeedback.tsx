import { View } from "react-native";
import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import { useConfirmedFormShare } from "../hooks/use-confirmed-form-share";
import { formDeliveryNotice } from "../utils/form-delivery-notice";

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
          <FormNotice
            tone={item.state === "failed" ? "warning" : "info"}
            compact
          >
            {formDeliveryNotice(item)}
          </FormNotice>
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
              Gửi lại thẻ vào Chat
            </Button>
          )}
        </View>
      ))}
    </View>
  );
}
