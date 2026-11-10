export type ContactToken = { value: string; index: number };
const markers = new Map([
  [".", "."],
  ["dot", "."],
  ["cham", "."],
  ["at", "@"],
  ["a cong", "@"],
]);

export function normalizeContactText(value: string) {
  return value
    .normalize("NFKC")
    .replaceAll("\u034f", "")
    .replace(
      /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff]/gu,
      "",
    )
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase()
    .replace(/\[[^\]\r\n]{1,16}\]|\([^)\r\n]{1,16}\)/gu, (marker) => {
      const key = marker.slice(1, -1).trim().replace(/\s+/gu, " ");
      return markers.get(key) ?? marker;
    });
}

export function contactTokens(text: string): ContactToken[] {
  return Array.from(text.matchAll(/[\p{L}\p{N}_%+-]+|[^\s]/gu), (match) => ({
    value: match[0],
    index: match.index,
  }));
}

const domainLabel = /^[\p{L}\p{N}-]+$/u;
const topLevelDomain = /^\p{L}{2,24}$/u;
function emailDomainAt(tokens: ContactToken[], start: number) {
  let cursor = start;
  let dots = 0;
  while (domainLabel.test(tokens[cursor]?.value ?? "")) {
    if (dots > 0 && topLevelDomain.test(tokens[cursor]!.value)) return true;
    if (tokens[cursor + 1]?.value !== ".") return false;
    dots++;
    cursor += 2;
  }
  return false;
}

export function hasContactEmail(text: string) {
  const tokens = contactTokens(
    text.replace(/\ba cong\b/gu, "@").replace(/\bcham\b/gu, "."),
  );
  return tokens.some(
    (token, index) =>
      token.value === "@" &&
      /^[\p{L}\p{N}._%+-]+$/u.test(tokens[index - 1]?.value ?? "") &&
      emailDomainAt(tokens, index + 1),
  );
}

const sep = String.raw`[\s().\-–•_*]*`;
const vnPhone = new RegExp(
  String.raw`(?:^|[^\p{N}])(?:0${sep}[35789](?:${sep}\d){8}|0${sep}2(?:${sep}\d){9}|(?:\+${sep}8${sep}4|0${sep}0${sep}8${sep}4)${sep}(?:[35789](?:${sep}\d){8}|2(?:${sep}\d){9}))(?![\p{N}])`,
  "u",
);
const internationalPhone = new RegExp(
  String.raw`(?:^|[^\p{L}\p{N}])\+${sep}[1-9](?:${sep}\d){8,14}(?![\p{L}\p{N}])`,
  "u",
);
const contextualPhone = new RegExp(
  String.raw`\b84${sep}[35789](?:${sep}\d){8}\b`,
);
const contactCue =
  /\b(?:sdt|so dien thoai|dien thoai|phone|call|lien he|nhan tin|ket ban|zalo|whatsapp)\b/u;
const spokenDigits: Record<string, string> = {
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
export function hasContactPhone(text: string) {
  if (vnPhone.test(text) || internationalPhone.test(text)) return true;
  if (!contactCue.test(text)) return false;
  const spoken = text.replace(
    /\b(?:khong|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin)\b/gu,
    (word) => spokenDigits[word]!,
  );
  return vnPhone.test(spoken) || contextualPhone.test(spoken);
}

function afterLabel(text: string, end: number) {
  return text
    .slice(end)
    .trimStart()
    .replace(/^[:=-]/u, "")
    .trimStart();
}
export function hasContactAddress(text: string) {
  const labels = text.matchAll(
    /\bdia chi(?: nha)?\b|\bnha (?:minh|toi) (?:o|tai)\b/gu,
  );
  for (const label of labels) {
    const address = afterLabel(text, label.index + label[0].length)
      .slice(0, 140)
      .split("\n", 1)[0]!
      .replace(/^so\s+/u, "");
    if (
      /^\d/u.test(address) &&
      /\b(?:duong|pho|phuong|quan|hem|ngo|xa|thon|ap|q)\b/u.test(address)
    )
      return true;
  }
  return false;
}
export function hasPrivateNumber(text: string) {
  const labels = text.matchAll(
    /\b(?:cccd|cmnd|can cuoc|ho chieu|so tai khoan|stk)\b/gu,
  );
  for (const label of labels) {
    const tail = afterLabel(text, label.index + label[0].length);
    const number = (/^\d[\d\s.-]*/u.exec(tail)?.[0] ?? "").trimEnd();
    const digits = number.replace(/\D/gu, "");
    const next = tail.charAt(number.length);
    if (
      digits.length >= 6 &&
      digits.length <= 19 &&
      !/[\p{L}\p{N}_]/u.test(next)
    )
      return true;
  }
  return false;
}
