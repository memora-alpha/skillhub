export const contactPolicyMessage =
  "Hãy bỏ số điện thoại, email hoặc thông tin liên hệ riêng trước khi gửi. Bạn có thể trao đổi ngay trong SkillHub.";
export type ContactKind = "phone" | "email" | "social" | "identity" | "address";
const contactHosts = new Set([
  "facebook.com",
  "fb.com",
  "fb.me",
  "messenger.com",
  "m.me",
  "zalo.me",
  "zaloapp.com",
  "t.me",
  "telegram.me",
  "wa.me",
  "api.whatsapp.com",
  "instagram.com",
  "ig.me",
  "discord.gg",
  "line.me",
]);
function hasContactLink(text: string) {
  for (const match of text.matchAll(
    /(?:https?:\/\/)?(?:www\.|m\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\/([^\s<>"()]*)/g,
  )) {
    const host = match[1] ?? "",
      path = match[2] ?? "";
    if (!path) continue;
    if (contactHosts.has(host)) return true;
    if (host === "linkedin.com" && path.startsWith("in/")) return true;
    if (host === "tiktok.com" && path.startsWith("@")) return true;
    if (host === "discord.com" && path.startsWith("invite/")) return true;
  }
  return false;
}

/** A text-only guard. Return a category, never retain or echo the matched data. */
export function detectContactInformation(value: string): ContactKind | null {
  const text = value
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
  const email = text
    .replace(/\s*(?:\[at\]|\(at\))\s*/g, "@")
    .replace(/\s*(?:\[dot\]|\(dot\))\s*/g, ".");
  if (/[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)+/i.test(email))
    return "email";
  // Require a complete number: no substring matches inside IDs or longer numbers.
  if (
    /(^|[^a-z0-9])(?:0[235789](?:[\s().-]*\d){8,9}|(?:\+?84)[\s().-]*[235789](?:[\s().-]*\d){8,9})(?![\s().-]*\d|[a-z])/i.test(
      text,
    ) ||
    /(^|[^a-z0-9])\+[1-9](?:[\s().-]*\d){7,14}(?![\s().-]*\d|[a-z])/i.test(text)
  )
    return "phone";
  if (
    hasContactLink(text) ||
    /\b(?:zalo|telegram|whatsapp|messenger|facebook|instagram|discord|skype|viber|wechat)\s*(?:(?:cua\s+)?(?:minh|toi|em|anh|chi)(?:\s+la)?|id|nick|username|la|:|=|@)\s*[:=@-]?\s*[a-z0-9_.-]{3,}/i.test(
      text,
    )
  )
    return "social";
  if (
    /\b(?:cccd|cmnd|can cuoc|ho chieu|passport|so tai khoan|stk|bank account)\s*(?:cua (?:minh|toi)\s*)?[:=-]?\s*(?:[a-z]{0,2}\s*)?\d(?:[\s.-]*\d){5,25}/i.test(
      text,
    )
  )
    return "identity";
  if (
    /\b(?:dia chi(?: nha| rieng)?|nha minh o|nha toi o)\s*[:=-]?\s*\d+[a-z]?(?:\/[\da-z]+)?\s+\p{L}+(?:\s+\p{L}+){1,}/u.test(
      text,
    )
  )
    return "address";
  return null;
}

export class ContactInformationError extends Error {
  readonly code = "CONTACT_INFORMATION_NOT_ALLOWED";
  constructor() {
    super(contactPolicyMessage);
    this.name = "ContactInformationError";
  }
}
