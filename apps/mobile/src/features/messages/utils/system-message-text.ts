import type { ApiMessage } from "../api/messages-api";

export function systemMessageText(
  message: Pick<ApiMessage, "messageType" | "messageText" | "objectType">,
) {
  const text = message.messageText;
  if (message.messageType !== "SYSTEM") return text;
  if (message.objectType === "LEARNING_PATH")
    return text.replace(
      /^Thỏa thuận đã được chốt\. Lịch học đã được khóa và (\d+) buổi học đã được tạo\. Xem lịch học\.$/u,
      "Đã chốt lịch · $1 buổi học.",
    );
  if (message.objectType !== "SCHEDULE_PROPOSAL") return text;
  // Shorten only known server wording; keep names, teaching direction and status.
  return text
    .replace(
      ". Hai bên đã xác nhận đổi lịch. Lịch mới đã được áp dụng.",
      " · Hai bên đã đồng ý, lịch mới đã áp dụng.",
    )
    .replace(
      ". Hai bên đã xác nhận lịch này. Chờ chốt thỏa thuận.",
      " · Đủ xác nhận, chờ chốt.",
    )
    .replace(
      /\. Đang chờ ([^\n]+) xác nhận đổi lịch\. Lịch hiện tại vẫn giữ nguyên\.$/u,
      " · Chờ $1 đồng ý đổi lịch; giữ lịch cũ.",
    )
    .replace(/\. Đang chờ ([^\n]+) xác nhận\.$/u, " · Chờ $1 xác nhận.");
}
