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
function normalize(value: string) {
  return value
    .normalize("NFKC")
    .replace(
      /[\u00ad\u034f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff]/g,
      "",
    )
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\[\s*\.\s*\]|\(\s*\.\s*\)/g, ".");
}
const sep = "[\\s().\\-–•_*]*";
const vnPhone = new RegExp(
  `(?:^|[^\\p{N}])(?:0${sep}[35789](?:${sep}\\d){8}|0${sep}2(?:${sep}\\d){9}|(?:\\+${sep}8${sep}4|0${sep}0${sep}8${sep}4)${sep}(?:[35789](?:${sep}\\d){8}|2(?:${sep}\\d){9}))(?![\\p{N}])`,
  "u",
);
const internationalPhone = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])\\+${sep}[1-9](?:${sep}\\d){8,14}(?![\\p{L}\\p{N}])`,
  "u",
);
const contactCue =
  /\b(?:sdt|so dien thoai|dien thoai|phone|call|lien he|nhan tin|ket ban|zalo|whatsapp)\b/;
const digits: Record<string, string> = {
  khong: "0",
  mot: "1",
  hai: "2",
  ba: "3",
  bon: "4",
  tu: "4",
  nam: "5",
  sau: "6",
  bay: "7",
  tam: "8",
  chin: "9",
};

export function findContactInformation(
  value: string,
): { kind: ContactInformationKind; message: string } | null {
  const text = normalize(value);
  let kind: ContactInformationKind | undefined;
  const email = text
    .replace(
      /\s*(?:\[\s*(?:at|a cong)\s*\]|\(\s*(?:at|a cong)\s*\)|\ba cong\b)\s*/g,
      "@",
    )
    .replace(
      /\s*(?:\[\s*(?:dot|cham)\s*\]|\(\s*(?:dot|cham)\s*\)|\bcham\b)\s*/g,
      ".",
    );
  if (
    /[\p{L}\p{N}._%+-]+\s*@\s*[\p{L}\p{N}-]+(?:\s*\.\s*[\p{L}\p{N}-]+)*\s*\.\s*\p{L}{2,24}\b/u.test(
      email,
    )
  )
    kind = "email";
  else if (vnPhone.test(text) || internationalPhone.test(text)) kind = "phone";
  else if (contactCue.test(text)) {
    const spoken = text.replace(
      /\b(?:khong|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin)\b/g,
      (word) => digits[word]!,
    );
    if (
      vnPhone.test(spoken) ||
      new RegExp(`\\b84${sep}[35789](?:${sep}\\d){8}\\b`).test(spoken)
    )
      kind = "phone";
  }
  if (
    !kind &&
    (/\b(?:zalo\s*\.\s*me|t\s*\.\s*me|telegram\s*\.\s*me|wa\s*\.\s*me|m\s*\.\s*me|fb\s*\.\s*me|discord\s*\.\s*gg|invite\s*\.\s*gg)\s*\//.test(
      text,
    ) ||
      /(?:^|[^\w.-])(?:https?:\/\/)?(?:(?:www|m|vm|vt)\.)?(?:facebook|fb|instagram|tiktok|threads)\s*\.\s*(?:com|net)\s*\/(?!help\b|policies\b|privacy\b|terms\b|developers\b)[\p{L}\p{N}@]/u.test(
        text,
      ) ||
      /\bdiscord\s*\.\s*com\s*\/(?:users|invite)\//.test(text) ||
      /\b(?:zalo|telegram|whatsapp|messenger|facebook|instagram|tiktok|discord|viber|signal|wechat|fb|ig)\s*(?:(?:cua\s+)?(?:minh|toi)\s*)?(?:(?:id|username|nick|tai khoan)\s*)?(?::|=|@|\bla\b)\s*@?[\p{L}\p{N}][\p{L}\p{N}_.-]{2,}/u.test(
        text,
      ) ||
      /\b(?:lien he|inbox|ib|ket ban|nhan tin|add)\s+(?:(?:qua|tai|tren)\s+)?(?:zalo|telegram|whatsapp|messenger|facebook|instagram|tiktok|discord|fb|ig)\s+@?[\p{L}\p{N}][\p{L}\p{N}_.-]{2,}/u.test(
        text,
      ) ||
      /\b(?:inbox|ib|lien he|nhan tin|add)\s+@[\p{L}\p{N}_.-]{3,}/u.test(text))
  )
    kind = "social";
  if (
    !kind &&
    /\b(?:dia chi(?: nha)?|nha (?:minh|toi) (?:o|tai))\s*[:=-]?\s*(?:so\s*)?\d+[^\n]{2,100}\b(?:duong|pho|phuong|quan|hem|ngo|xa|thon|ap|q\.)/.test(
      text,
    )
  )
    kind = "address";
  if (
    !kind &&
    /\b(?:cccd|cmnd|can cuoc|ho chieu|so tai khoan|stk)\s*[:=-]?\s*\d(?:[\s.-]*\d){5,18}\b/.test(
      text,
    )
  )
    kind = "private-number";
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
