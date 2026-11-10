import {
  readConfirmedForm,
  readScheduledMessage,
} from "@/features/learning-paths/policy";
import type { FormDelivery } from "./confirmed-form-delivery";

export function formDeliveryNotice(item: FormDelivery) {
  const form = readConfirmedForm(item.messageText);
  let subject = "Lịch học";
  if (form?.kind === "method") subject = "Cách học";
  else if (form?.kind === "plan") subject = "Lộ trình";
  let saved = "Thao tác đã được lưu.";
  if (readScheduledMessage(item.messageText)) saved = "Lịch học đã được chốt.";
  else if (form) saved = `${subject} đã được xác nhận.`;
  if (item.state === "sending")
    return `${saved} Đang gửi thẻ cập nhật vào Chat…`;
  if (item.state === "processing")
    return `${saved} Thẻ cập nhật vào Chat đang được xử lý.`;
  return `${saved} Chưa gửi được thẻ cập nhật vào Chat. Bạn chỉ cần gửi lại thẻ, không cần thực hiện lại thao tác đã lưu.`;
}
