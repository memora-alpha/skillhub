import { Text } from "react-native";
import { Button } from "@/components/Button";
import { SubscriptionFeedback } from "./subscription-feedback";
import { InfoModal } from "@/components/InfoModal";
import type { SubscriptionConfirmation as Confirmation } from "../utils/subscription-confirmation";
import { membershipStyles as s } from "./subscription.styles";

export function SubscriptionConfirmation({
  confirmation,
  busy,
  blocked,
  stale,
  onClose,
  onConfirm,
}: Readonly<{
  confirmation: Confirmation | null;
  busy: boolean;
  blocked: boolean;
  stale: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>) {
  return (
    <InfoModal
      title={confirmation?.title ?? null}
      onClose={onClose}
      showConfirm={false}
      busy={busy}
      titleStyle={s.title}
      footer={
        <Button variant="craft" disabled={blocked} onPress={onConfirm}>
          {busy ? "Đang xử lý…" : "Xác nhận"}
        </Button>
      }
    >
      <Text style={s.body}>{confirmation?.description}</Text>
      {stale && (
        <SubscriptionFeedback>
          Thông tin đã thay đổi. Đóng xác nhận, tải lại và kiểm tra giá mới
          trước khi tiếp tục.
        </SubscriptionFeedback>
      )}
    </InfoModal>
  );
}
