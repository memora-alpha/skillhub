import {
  normalizeContactText,
  hasContactEmail,
  hasContactPhone,
  hasContactAddress,
  hasPrivateNumber,
} from "./contact-patterns";
import { hasSocialContact } from "./contact-social";

/** Client-side text policy shared by Web, Expo and the ephemeral room transport.
 * Returns categories only; never log or echo the detected private value. */
export type ContactInformationKind =
  "phone" | "email" | "social" | "address" | "private-number";
export const contactInformationNotice =
  "Không chia sẻ số điện thoại, email hoặc thông tin liên hệ riêng. Hãy trao đổi trong SkillHub.";
export const hiddenContactMessage =
  "Tin nhắn đã được ẩn vì chứa thông tin liên hệ hoặc dữ liệu cá nhân.";
const reasons: Record<ContactInformationKind, string> = {
  phone: "Tin nhắn có số điện thoại.",
  email: "Tin nhắn có địa chỉ email.",
  social: "Tin nhắn có tài khoản hoặc liên kết liên hệ riêng.",
  address: "Tin nhắn có địa chỉ liên hệ cá nhân.",
  "private-number": "Tin nhắn có số giấy tờ hoặc tài khoản cá nhân.",
};
const detectors: ReadonlyArray<
  readonly [ContactInformationKind, (text: string) => boolean]
> = [
  ["email", hasContactEmail],
  ["phone", hasContactPhone],
  ["social", hasSocialContact],
  ["address", hasContactAddress],
  ["private-number", hasPrivateNumber],
];
export function findContactInformation(
  value: string,
): { kind: ContactInformationKind; message: string } | null {
  const text = normalizeContactText(value);
  const kind = detectors.find(([, matches]) => matches(text))?.[0];
  return kind
    ? {
        kind,
        message: `${reasons[kind]} Vui lòng bỏ thông tin này và trao đổi trong SkillHub.`,
      }
    : null;
}
export class ContactInformationError extends Error {
  constructor(public readonly kind: ContactInformationKind) {
    super(
      `${reasons[kind]} Vui lòng bỏ thông tin này và trao đổi trong SkillHub.`,
    );
    this.name = "ContactInformationError";
  }
}
export function assertNoContactInformation(text: string) {
  const issue = findContactInformation(text);
  if (issue) throw new ContactInformationError(issue.kind);
}
export function safeChatText(text: string) {
  return findContactInformation(text) ? hiddenContactMessage : text;
}
