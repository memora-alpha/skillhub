export const contentPolicyMessage =
  "Nội dung có chứa ngôn từ thô tục hoặc xúc phạm. Vui lòng chỉnh sửa trước khi gửi.";

export const imageModerationBlockedMessage =
  "Ảnh có dấu hiệu nội dung phản cảm hoặc chứa ngôn từ không phù hợp nên không thể gửi.";

export type InappropriateTextKind = "profanity" | "harassment";

type RuleSpec = {
  kind: InappropriateTextKind;
  terms: readonly string[];
};

const splitTerms = (packed: string) => packed.split("|");

// Vietnamese rules are matched strictly WITH diacritics preserved (NFC after NFKC)
// so polite Vietnamese words ("ngủ", "ngũ", "ngư", "bộ máy", "chỗ để", "vợ học",
// "chả mấy", "đồ cho", "đủ mà", "cut đi", "còn điện", "còn rảnh", "mà mấy"...)
// never false-positive. Ambiguous 2-letter acronyms ("dm", "ml", "cc") are also excluded.
const accentedRules: readonly RuleSpec[] = [
  {
    kind: "profanity",
    terms: splitTerms(
      "địt mẹ|địt con mẹ|địt cụ|địt|đụ má|đụ mẹ|đụ|đù má|đù|đéo|vãi lồn|vãi cứt|vãi cặc|vãi|lồn|cặc|buồi|đĩ|con đĩ|đm|đmm|đcm|đcmm|cứt|dit me|dit con me|dit cu|du ma|du me|vai lon|vai cac|vai cut|dmm|dcm|dcmm|clm|clmm|vcl|vl|vkl|cmm",
    ),
  },
  {
    kind: "harassment",
    terms: splitTerms(
      "mày ngu|đồ ngu|ngu như chó|ngu vãi|ngu quá|ngu thế|ngu vậy|ngu|óc chó|đồ chó|thằng chó|con chó|mặt chó|hi chó|chó chết|chó đẻ|mẹ mày|má mày|bố mày|cha mày|cả nhà mày|câm mõm|ngậm mõm|cút đi|biến đi|súc vật|khốn nạn|mất dạy|vô học|thằng điên|con điên|thằng ranh|con ranh|đập chết|giết mày|ngu nhu cho|oc cho|cam mom|ngam mom|suc vat|khon nan",
    ),
  },
];

// English profanity/harassment terms checked after leetspeak normalization
// (still without stripping Vietnamese diacritics).
const englishRules: readonly RuleSpec[] = [
  {
    kind: "profanity",
    terms: splitTerms(
      "fuck|fucker|fucking|motherfucker|shit|bullshit|bitch|asshole|bastard|cunt|dick|pussy|whore|slut|faggot|nigger|wtf|stfu",
    ),
  },
  {
    kind: "harassment",
    terms: splitTerms("retard|kill yourself|kys"),
  },
];

// Exact standalone insult callouts (whole message after trimming edge symbols/punctuation)
const standaloneAccentedInsults = new Set(
  splitTerms("chó|ngu|điên|cút|rác|phế"),
);

// Underscore is intentionally excluded from wordChar so "_ngu" / "test_vcl" cannot bypass.
const wordChar = String.raw`[\p{L}\p{M}\p{N}]`;
// Join phrase tokens across whitespace, Unicode punctuation (\p{P}) and symbols (\p{S})
// so "địt+mẹ", "đụ=má", "câm$mõm", "vô=học" cannot bypass.
const wordJoin = String.raw`[\s\p{P}\p{S}]+`;

// Disjoint separator classes prevent ReDoS backtracking and avoid matching "/" in "d/m/y".
const sep = String.raw`[._~+=$^-]`;
const sepOrStar = String.raw`[.*_~+=$^-]`;

function escapeRegex(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

function expandTokenWithRepetitions(token: string): string {
  const chars = [...token];
  const segments: string[] = [];
  let index = 0;
  while (index < chars.length) {
    const ch = chars[index]!;
    let count = 1;
    while (index + count < chars.length && chars[index + count] === ch) {
      count++;
    }
    const escaped = escapeRegex(ch);
    segments.push(count === 1 ? `${escaped}+` : `${escaped}{${count},}`);
    index += count;
  }
  return segments.join("");
}

function buildPattern(terms: readonly string[]) {
  const parts = terms.map((term) =>
    term.split(/\s+/u).map(expandTokenWithRepetitions).join(wordJoin),
  );
  return new RegExp(
    `(?<!${wordChar})(?:${parts.join("|")})(?!${wordChar})`,
    "u",
  );
}

const compiledAccented = accentedRules.map((rule) => ({
  kind: rule.kind,
  pattern: buildPattern(rule.terms),
}));

const compiledEnglish = englishRules.map((rule) => ({
  kind: rule.kind,
  pattern: buildPattern(rule.terms),
}));

// Obfuscated slang tokens that explicitly use separators or mask characters
// (e.g. đ.m, đ*m, d*m, n.g.u, v.c.l, đ.é.o, đ*o, đ*t, l*n, l0n, c*c, c@c, f*ck, sh!t)
// matched on accented (NFC) text without "/" so "d/m/y", "lớn", "các", "buổi", "đeo" never false-positive.
const obfuscatedSlurs = new RegExp(
  `(?<!${wordChar})(?:` +
    [
      `đ+${sepOrStar}+m+`,
      String.raw`d+\*+m+`,
      `[dđ]+${sepOrStar}+c+${sepOrStar}*m+`,
      `c+${sepOrStar}+l+${sepOrStar}*m+`,
      `v+${sepOrStar}+c+${sepOrStar}*l+`,
      `n+${sepOrStar}+g+${sepOrStar}+u+`,
      `đ+${sepOrStar}+é+${sepOrStar}+o+`,
      String.raw`đ+\*+o+`,
      `[dđ]+${sep}*[*!@]+${sep}*t+`,
      `đ+${sep}*1+${sep}*t+`,
      `d+${sepOrStar}+i+${sepOrStar}+t+`,
      `đ+${sepOrStar}+ị+${sepOrStar}+t+`,
      `l+${sep}*[0*@]+${sep}*n+`,
      `l+${sepOrStar}+o+${sepOrStar}+n+`,
      `l+${sepOrStar}+ồ+${sepOrStar}+n+`,
      `c+${sep}*[*@]+${sep}*c+`,
      `c+${sepOrStar}+a+${sepOrStar}+c+`,
      `c+${sepOrStar}+ặ+${sepOrStar}+c+`,
      `f+${sep}*[*@]+${sep}*c+${sepOrStar}*k+`,
      `f+${sepOrStar}+u+${sepOrStar}*c+${sepOrStar}*k+`,
      `s+${sepOrStar}*h+${sep}*[1!*]+${sep}*t+`,
      `s+${sepOrStar}+h+${sepOrStar}+i+${sepOrStar}+t+`,
      `b+${sep}*[1!*]+${sep}*t+${sepOrStar}*c+${sepOrStar}*h+`,
    ].join("|") +
    `)(?!${wordChar})`,
  "u",
);

const edgePunctuationChar = /^[\p{P}\p{S}\s]$/u;

function trimEdgePunctuation(text: string): string {
  const chars = [...text];
  let start = 0;
  let end = chars.length;
  while (start < end && edgePunctuationChar.test(chars[start]!)) start++;
  while (end > start && edgePunctuationChar.test(chars[end - 1]!)) end--;
  return chars.slice(start, end).join("");
}

function normalizeAccented(text: string): string {
  return text
    .normalize("NFKC")
    .replaceAll(/\p{Cf}/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .trim();
}

function normalizeLeetspeak(text: string): string {
  return text
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    .replaceAll(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replaceAll(/(?<=[a-z])1(?=[a-z])/g, "i")
    .replaceAll(/(?<=[a-z])3(?=[a-z])/g, "e")
    .replaceAll(/(?<=[a-z])4(?=[a-z])/g, "a");
}

/**
 * Client-side moderation guard for LiveKit P2P room chat.
 * Preserves Vietnamese diacritics to avoid false positives on everyday Vietnamese.
 */
export function detectInappropriateText(
  value: string,
): InappropriateTextKind | null {
  const accented = normalizeAccented(value);
  if (!accented) return null;

  const bareStandalone = trimEdgePunctuation(accented);
  if (standaloneAccentedInsults.has(bareStandalone)) return "harassment";

  for (const rule of compiledAccented) {
    if (rule.pattern.test(accented)) return rule.kind;
  }

  if (obfuscatedSlurs.test(accented)) return "profanity";

  const deLeet = normalizeLeetspeak(accented);
  for (const rule of compiledEnglish) {
    if (rule.pattern.test(deLeet)) return rule.kind;
  }

  return null;
}
