import type { ApiMessage } from "../api/messages-api";
import { systemMessageText } from "../utils/system-message-text";
import { ChatNotice } from "./ChatNotice";
import type { IconName } from "@/components/Icon";

export function ChatSystemNotice({
  message,
}: Readonly<{ message: ApiMessage }>) {
  const schedule = message.objectType === "SCHEDULE_PROPOSAL";
  const agreement = message.objectType === "LEARNING_PATH";
  const text = systemMessageText(message) || "Cập nhật từ hệ thống";
  const finalized =
    agreement &&
    text !== message.messageText &&
    text.startsWith("Đã chốt lịch ·");
  const confirmed =
    schedule &&
    (message.messageText.endsWith(
      "Hai bên đã xác nhận lịch này. Chờ chốt thỏa thuận.",
    ) ||
      message.messageText.endsWith(
        "Hai bên đã xác nhận đổi lịch. Lịch mới đã được áp dụng.",
      ));
  let label = "Thông báo hệ thống";
  let icon: IconName = "bell";
  if (schedule) {
    label = "Lịch học";
    icon = "calendar";
  } else if (agreement) {
    label = "Thỏa thuận học";
    icon = "book";
  }
  if (finalized || confirmed) icon = "check-circle";
  return (
    <ChatNotice
      label={label}
      title={text}
      tone={finalized || confirmed ? "success" : "info"}
      icon={icon}
    />
  );
}
