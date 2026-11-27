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

const accentedRules: readonly RuleSpec[] = [
  {
    kind: "profanity",
    terms: splitTerms(
      "địt mẹ|địt|đụ má|đụ mẹ|đụ|đù má|đù|đéo|vãi lồn|vãi cứt|vãi cặc|vãi|lồn|cặc|buồi|đĩ|con đĩ|đm|đmm|đcm|đcmm|cứt",
    ),
  },
  {
    kind: "harassment",
    terms: splitTerms(
      "mày ngu|đồ ngu|ngu như chó|ngu vãi|ngu quá|ngu thế|ngu vậy|óc chó|đồ chó|thằng chó|con chó|mặt chó|hi chó|chó chết|chó đẻ|mẹ mày|má mày|bố mày|cha mày|cả nhà mày|câm mõm|ngậm mõm|cút đi|biến đi|súc vật|khốn nạn|mất dạy|vô học|thằng điên|con điên|thằng ranh|con ranh|đập chết|giết mày",
    ),
  },
];

// Terms safe to match on accent-folded / leetspeak-normalized ASCII text.
// Bare Vietnamese words like "lon"/"cac"/"buoi"/"deo" are intentionally excluded
// to avoid false positives on "lớn", "các", "buổi", "đeo", "lộn".
const foldedRules: readonly RuleSpec[] = [
  {
    kind: "profanity",
    terms: splitTerms(
      "dit me|dit con me|dit cu|du ma|du me|vai lon|vai cac|vai cut|dm|dmm|dcm|dcmm|clm|clmm|vcl|vl|vkl|cmm|cc|ml|fuck|fucker|fucking|motherfucker|shit|bullshit|bitch|asshole|bastard|cunt|dick|pussy|whore|slut|faggot|nigger|wtf|stfu",
    ),
  },
  {
    kind: "harassment",
    terms: splitTerms(
      "may ngu|do ngu|ngu nhu cho|ngu vai|oc cho|do cho|thang cho|mat cho|hi cho|cho chet|cho de|me may|ma may|bo may|cha may|cam mom|ngam mom|cut di|suc vat|khon nan|mat day|vo hoc|thang dien|con dien|thang ranh|con ranh|ngu|retard|kill yourself|kys",
    ),
  },
];

// Exact standalone insult callouts (whole message after trimming punctuation)
const standaloneAccentedInsults = new Set(
  splitTerms("chó|ngu|điên|cút|rác|phế"),
);

const wordChar = String.raw`[\p{L}\p{M}\p{N}_]`;
const wordJoin = String.raw`[\s\p{P}]+`;
const sep = String.raw`[\s.*_~/-]`;
const maskSep = String.raw`[\s._~/-]`;

function escapeRegex(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

function buildPattern(terms: readonly string[]) {
  const parts = terms.map((term) =>
    term
      .split(/\s+/u)
      .map((part) => [...part].map((ch) => `${escapeRegex(ch)}+`).join(""))
      .join(wordJoin),
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

const compiledFolded = foldedRules.map((rule) => ({
  kind: rule.kind,
  pattern: buildPattern(rule.terms),
}));

// Obfuscated slang tokens that explicitly use separators or mask characters
// (e.g. d.m, d*m, d_m_m, c.l.m, v.c.l, đ*t, l*n, l0n, c*c, c@c, f*ck, sh!t)
// so plain Vietnamese words like "lớn", "các", "buổi", "đeo" never false-positive.
const obfuscatedSlurs = new RegExp(
  `(?<!${wordChar})(?:` +
    [
      `d+${sep}+m+`,
      `d+${sep}+c+${sep}*m+`,
      `c+${sep}+l+${sep}*m+`,
      `v+${sep}+c+${sep}*l+`,
      `d+${maskSep}*[1!*@]+${maskSep}*t+`,
      `d+${sep}+i+${sep}*t+`,
      `l+${maskSep}*[0*@]+${maskSep}*n+`,
      `l+${sep}+o+${sep}*n+`,
      `c+${maskSep}*[4*@]+${maskSep}*c+`,
      `c+${sep}+a+${sep}*c+`,
      `f+${maskSep}*[u*@]+${maskSep}*c+${sep}*k+`,
      `s+${sep}*h+${maskSep}*[1!*]+${maskSep}*t+`,
      `b+${maskSep}*[1!*]+${maskSep}*t+${sep}*c+${sep}*h+`,
    ].join("|") +
    `)(?!${wordChar})`,
  "u",
);

const edgePunctuationChar = /^[\p{P}\s]$/u;

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

function normalizeFolded(text: string): string {
  return text
    .normalize("NFKC")
    .replaceAll(/\p{Cf}/gu, "")
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

function normalizeLeetspeak(folded: string): string {
  return folded
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    .replaceAll(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replaceAll(/(?<=[a-z])1(?=[a-z])/g, "i")
    .replaceAll(/(?<=[a-z])3(?=[a-z])/g, "e")
    .replaceAll(/(?<=[a-z])4(?=[a-z])/g, "a");
}

/**
 * Client-side pre-moderation guard for Vietnamese & English profanity/abuse.
 * Runs synchronously before sending to LiveKit P2P chat or the SkillHub API.
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

  const folded = normalizeFolded(value);
  if (obfuscatedSlurs.test(folded)) return "profanity";

  const deLeet = normalizeLeetspeak(folded);
  for (const rule of compiledFolded) {
    if (rule.pattern.test(deLeet)) return rule.kind;
  }

  return null;
}
