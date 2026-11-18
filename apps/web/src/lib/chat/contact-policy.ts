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
const socialNetworks = [
  "zalo",
  "telegram",
  "whatsapp",
  "messenger",
  "facebook",
  "instagram",
  "discord",
  "skype",
  "viber",
  "wechat",
];

function advance(text: string, start: number, character: RegExp) {
  let end = start;
  while (character.test(text.charAt(end))) end++;
  return end;
}
function skipSpace(text: string, start: number) {
  return advance(text, start, /\s/);
}
function contactHostBefore(token: string, slash: number) {
  let start = slash;
  while (/[a-z0-9.-]/.test(token.charAt(start - 1))) start--;
  let host = token.slice(start, slash);
  const emptyLabel = host.lastIndexOf("..");
  if (emptyLabel !== -1) host = host.slice(emptyLabel + 2);
  host = host.replace(/^\.+/, "");
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)) return null;
  if (host.startsWith("www.") && host.indexOf(".", 4) !== -1)
    host = host.slice(4);
  else if (host.startsWith("m.") && host.indexOf(".", 2) !== -1)
    host = host.slice(2);
  return host;
}
function isContactPath(host: string, token: string, slash: number) {
  if (slash === token.length - 1) return false;
  if (contactHosts.has(host)) return true;
  const start = slash + 1;
  if (host === "linkedin.com") return token.startsWith("in/", start);
  if (host === "tiktok.com") return token.startsWith("@", start);
  return host === "discord.com" && token.startsWith("invite/", start);
}
function hasContactLink(text: string) {
  for (const [token] of text.matchAll(/[^\s<>"()]+/g)) {
    let slash = token.indexOf("/");
    while (slash !== -1) {
      const host = contactHostBefore(token, slash);
      if (host) {
        if (isContactPath(host, token, slash)) return true;
        break;
      }
      slash = token.indexOf("/", slash + 1);
    }
  }
  return false;
}

function hasEmail(text: string) {
  const email = text
    .replaceAll("[at]", "@")
    .replaceAll("(at)", "@")
    .replaceAll("[dot]", ".")
    .replaceAll("(dot)", ".");
  for (const match of email.matchAll(/@/g)) {
    let local = match.index - 1;
    while (/\s/.test(email.charAt(local))) local--;
    if (!/[a-z0-9._%+-]/.test(email.charAt(local))) continue;
    const start = skipSpace(email, match.index + 1);
    const end = advance(email, start, /[a-z0-9-]/);
    if (end === start) continue;
    const dot = skipSpace(email, end);
    if (email.charAt(dot) !== ".") continue;
    if (/[a-z0-9-]/.test(email.charAt(skipSpace(email, dot + 1)))) return true;
  }
  return false;
}

function phoneSuffix(
  text: string,
  start: number,
  count: number,
  third: number,
) {
  const previous = text.charAt(start - 1);
  if (/[a-z0-9]/.test(previous)) return false;
  if (
    previous === "+" &&
    !/[a-z0-9]/.test(text.charAt(start - 2)) &&
    /[1-9]/.test(text.charAt(start)) &&
    count >= 8 &&
    count <= 15
  )
    return true;
  if (
    (count === 10 || count === 11) &&
    text.charAt(start) === "0" &&
    /[235789]/.test(text.charAt(start + 1))
  )
    return true;
  return (
    (count === 11 || count === 12) &&
    text.startsWith("84", start) &&
    /[235789]/.test(text.charAt(third))
  );
}
function hasPhone(text: string) {
  for (const match of text.matchAll(/\+?\d[\d\s().-]*/g)) {
    // Only the final fifteen digits can form a complete supported number.
    const positions: number[] = [];
    for (let index = 0; index < match[0].length; index++) {
      if (!/\d/.test(match[0].charAt(index))) continue;
      positions.push(match.index + index);
      if (positions.length > 15) positions.shift();
    }
    const last = positions.at(-1)!;
    if (/[a-z]/.test(text.charAt(last + 1))) continue;
    if (
      positions.some((start, index) =>
        phoneSuffix(
          text,
          start,
          positions.length - index,
          positions[index + 2] ?? -1,
        ),
      )
    )
      return true;
  }
  return false;
}

function hasHandleAfter(text: string, start: number) {
  let cursor = skipSpace(text, start);
  const handle = /^[a-z0-9_.-]{3}/;
  if (handle.test(text.slice(cursor, cursor + 3))) return true;
  if (!/[:=@-]/.test(text.charAt(cursor))) return false;
  cursor = skipSpace(text, cursor + 1);
  return handle.test(text.slice(cursor, cursor + 3));
}
function hasSocialHandle(text: string, start: number) {
  let cursor = skipSpace(text, start);
  const marker = /^(?:id|nick|username|la|[:=@])/.exec(
    text.slice(cursor, cursor + 8),
  );
  if (marker && hasHandleAfter(text, cursor + marker[0].length)) return true;
  if (text.startsWith("cua", cursor) && /\s/.test(text.charAt(cursor + 3)))
    cursor = skipSpace(text, cursor + 3);
  const pronoun = /^(?:minh|toi|em|anh|chi)/.exec(
    text.slice(cursor, cursor + 4),
  );
  if (!pronoun) return false;
  cursor += pronoun[0].length;
  if (hasHandleAfter(text, cursor)) return true;
  const afterSpace = skipSpace(text, cursor);
  return (
    afterSpace > cursor &&
    text.startsWith("la", afterSpace) &&
    hasHandleAfter(text, afterSpace + 2)
  );
}
function hasSocial(text: string) {
  if (hasContactLink(text)) return true;
  for (const match of text.matchAll(/\b[a-z]+/g)) {
    const network = socialNetworks.find((name) => match[0].startsWith(name));
    if (network && hasSocialHandle(text, match.index + network.length))
      return true;
  }
  return false;
}

function labelledValueStart(text: string, start: number) {
  let cursor = skipSpace(text, start);
  if (/[:=-]/.test(text.charAt(cursor))) cursor++;
  return skipSpace(text, cursor);
}
function hasIdentityNumber(text: string, start: number) {
  let cursor = skipSpace(text, start);
  for (const owner of ["cua minh", "cua toi"])
    if (text.startsWith(owner, cursor)) {
      cursor = skipSpace(text, cursor + owner.length);
      break;
    }
  cursor = labelledValueStart(text, cursor);
  let letters = 0;
  while (letters < 2 && /[a-z]/.test(text.charAt(cursor))) {
    cursor++;
    letters++;
  }
  cursor = skipSpace(text, cursor);
  if (!/\d/.test(text.charAt(cursor))) return false;
  for (let digits = 1; digits < 6; digits++) {
    cursor = advance(text, cursor + 1, /[\s.-]/);
    if (!/\d/.test(text.charAt(cursor))) return false;
  }
  return true;
}
function hasIdentity(text: string) {
  for (const match of text.matchAll(
    /\b(?:cccd|cmnd|can cuoc|ho chieu|passport|so tai khoan|stk|bank account)/g,
  ))
    if (hasIdentityNumber(text, match.index + match[0].length)) return true;
  return false;
}
function hasAddressWords(text: string, start: number) {
  const number = advance(text, start, /\d/);
  if (number === start) return false;
  let cursor = number;
  if (/[a-z]/.test(text.charAt(cursor))) cursor++;
  if (text.charAt(cursor) === "/") {
    const end = advance(text, cursor + 1, /[a-z0-9]/);
    if (end === cursor + 1) return false;
    cursor = end;
  }
  const wordStart = skipSpace(text, cursor);
  if (wordStart === cursor) return false;
  const word = /\p{L}+/uy;
  word.lastIndex = wordStart;
  if (!word.test(text)) return false;
  const nextWord = skipSpace(text, word.lastIndex);
  if (nextWord === word.lastIndex) return false;
  word.lastIndex = nextWord;
  return word.test(text);
}
function hasAddress(text: string) {
  for (const match of text.matchAll(/\b(?:dia chi|nha minh o|nha toi o)/g)) {
    let start = match.index + match[0].length;
    if (match[0] === "dia chi") {
      const qualifier = [" nha", " rieng"].find((word) =>
        text.startsWith(word, start),
      );
      start += qualifier?.length ?? 0;
    }
    if (hasAddressWords(text, labelledValueStart(text, start))) return true;
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
  if (hasEmail(text)) return "email";
  if (hasPhone(text)) return "phone";
  if (hasSocial(text)) return "social";
  if (hasIdentity(text)) return "identity";
  if (hasAddress(text)) return "address";
  return null;
}

export class ContactInformationError extends Error {
  readonly code = "CONTACT_INFORMATION_NOT_ALLOWED";
  constructor() {
    super(contactPolicyMessage);
    this.name = "ContactInformationError";
  }
}
