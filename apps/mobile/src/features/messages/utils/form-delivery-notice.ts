import {
  readConfirmedForm,
  readScheduledMessage,
} from "@/features/learning-paths/policy";
import type { FormDelivery } from "./confirmed-form-delivery";

export function formDeliveryNotice(item: FormDelivery) {
  const form = readConfirmedForm(item.messageText);
  const subject =
    form?.kind === "method"
      ? "Cách học"
      : form?.kind === "plan"
        ? "Lộ trình"
        : "Lịch học";
  const saved = readScheduledMessage(item.messageText)
    ? "Lịch học đã được chốt."
    : form
      ? `${subject} đã được xác nhận.`
      : "Thao tác đã được lưu.";
  if (item.state === "sending")
    return `${saved} Đang gửi thẻ cập nhật vào Chat…`;
  if (item.state === "processing")
    return `${saved} Thẻ cập nhật vào Chat đang được xử lý.`;
  return `${saved} Chưa gửi được thẻ cập nhật vào Chat. Bạn chỉ cần gửi lại thẻ, không cần thực hiện lại thao tác đã lưu.`;
}
