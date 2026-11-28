import { detectContactInformation } from "./contact-policy";
import { detectInappropriateText } from "./content-policy";

export const maskedContactRoomMessage =
  "[Tin nhắn đã bị ẩn vì chứa thông tin liên hệ cá nhân.]";

export const maskedProfanityRoomMessage =
  "[Tin nhắn đã bị ẩn do vi phạm tiêu chuẩn cộng đồng.]";

export function sanitizeIncomingRoomMessage<
  T extends { text: string; own: boolean },
>(message: T): T {
  if (message.own) return message;
  if (detectContactInformation(message.text)) {
    return { ...message, text: maskedContactRoomMessage };
  }
  if (detectInappropriateText(message.text)) {
    return { ...message, text: maskedProfanityRoomMessage };
  }
  return message;
}
