export const contentPolicyMessage =
  "Nội dung có chứa ngôn từ thô tục hoặc xúc phạm. Vui lòng chỉnh sửa trước khi gửi.";

export const imageModerationBlockedMessage =
  "Ảnh có dấu hiệu nội dung phản cảm hoặc chứa ngôn từ không phù hợp nên không thể gửi.";

export type InappropriateTextKind = "profanity" | "harassment";

type RuleSpec = {
  kind: InappropriateTextKind;
  terms: readonly string[];
};

const accentedRules: readonly RuleSpec[] = [
  {
    kind: "profanity",
    terms: [
      "địt mẹ",
      "địt",
      "đụ má",
      "đụ mẹ",
      "đụ",
      "đù má",
      "đù",
      "đéo",
      "vãi lồn",
      "vãi cứt",
      "vãi cặc",
      "vãi",
      "lồn",
      "cặc",
      "buồi",
      "đĩ",
      "con đĩ",
      "đm",
      "đmm",
      "đcm",
      "đcmm",
      "cứt",
    ],
  },
  {
    kind: "harassment",
    terms: [
      "mày ngu",
      "đồ ngu",
      "ngu như chó",
      "ngu vãi",
      "ngu quá",
      "ngu thế",
      "ngu vậy",
      "óc chó",
      "đồ chó",
      "thằng chó",
      "con chó",
      "mặt chó",
      "hi chó",
      "chó chết",
      "chó đẻ",
      "mẹ mày",
      "má mày",
      "bố mày",
      "cha mày",
      "cả nhà mày",
      "câm mõm",
      "ngậm mõm",
      "cút đi",
      "biến đi",
      "súc vật",
      "khốn nạn",
      "mất dạy",
      "vô học",
      "thằng điên",
      "con điên",
      "thằng ranh",
      "con ranh",
      "đập chết",
      "giết mày",
    ],
  },
];

// Terms safe to match on accent-folded / leetspeak-normalized ASCII text
const foldedRules: readonly RuleSpec[] = [
  {
    kind: "profanity",
    terms: [
      "dit me",
      "dit con me",
      "dit cu",
      "du ma",
      "du me",
      "vai lon",
      "vai cac",
      "vai cut",
      "dm",
      "dmm",
      "dcm",
      "dcmm",
      "clm",
      "clmm",
      "vcl",
      "vl",
      "vkl",
      "cmm",
      "cc",
      "ml",
      "lon",
      "cac",
      "buoi",
      "deo",
      "fuck",
      "fucker",
      "fucking",
      "motherfucker",
      "shit",
      "bullshit",
      "bitch",
      "asshole",
      "bastard",
      "cunt",
      "dick",
      "pussy",
      "whore",
      "slut",
      "faggot",
      "nigger",
      "wtf",
      "stfu",
    ],
  },
  {
    kind: "harassment",
    terms: [
      "may ngu",
      "do ngu",
      "ngu nhu cho",
      "ngu vai",
      "oc cho",
      "do cho",
      "thang cho",
      "mat cho",
      "hi cho",
      "cho chet",
      "cho de",
      "me may",
      "ma may",
      "bo may",
      "cha may",
      "cam mom",
      "ngam mom",
      "cut di",
      "suc vat",
      "khon nan",
      "mat day",
      "vo hoc",
      "thang dien",
      "con dien",
      "thang ranh",
      "con ranh",
      "ngu",
      "retard",
      "kill yourself",
      "kys",
    ],
  },
];

// Exact standalone insult callouts (whole message after trimming punctuation)
const standaloneAccentedInsults = new Set([
  "chó",
  "ngu",
  "điên",
  "cút",
  "rác",
  "phế",
]);

const wordChar = "[\\p{L}\\p{M}\\p{N}_]";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function buildPattern(terms: readonly string[], allowInnerSeparators: boolean) {
  const parts = terms.map((term) => {
    const words = term.split(/\s+/u).map((part) => {
      if (allowInnerSeparators && part.length >= 2 && part.length <= 5) {
        return [...part].map((ch) => `${escapeRegex(ch)}+`).join("[\\s.*_~-]*");
      }
      return [...part].map((ch) => `${escapeRegex(ch)}+`).join("");
    });
    return words.join("[\\s\\p{P}]+");
  });
  return new RegExp(
    `(?<!${wordChar})(?:${parts.join("|")})(?!${wordChar})`,
    "u",
  );
}

const compiledAccented = accentedRules.map((rule) => ({
  kind: rule.kind,
  pattern: buildPattern(rule.terms, false),
}));

// Keep bare "lon" / "cac" / "buoi" / "deo" out of ASCII-folded matching to avoid
// Vietnamese false positives like "lớn", "các", "buổi", "đeo", "lộn".
const safeAsciiTerms = (terms: readonly string[]) =>
  terms.filter((t) => !["lon", "cac", "buoi", "deo"].includes(t));

const compiledFolded = foldedRules.map((rule) => ({
  kind: rule.kind,
  pattern: buildPattern(safeAsciiTerms(rule.terms), false),
}));

// Obfuscated slang tokens that explicitly use separators or mask characters
// (e.g. d.m, d*m, d_m_m, c.l.m, v.c.l, đ*t, l*n, l0n, c*c, c@c, f*ck, sh!t)
// so plain Vietnamese words like "lớn", "các", "buổi", "đeo" never false-positive.
const obfuscatedSlurs = new RegExp(
  `(?<!${wordChar})(?:` +
    [
      "d+[\\s.*_~/-]+m+",
      "d+[\\s.*_~/-]+c+[\\s.*_~/-]*m+",
      "c+[\\s.*_~/-]+l+[\\s.*_~/-]*m+",
      "v+[\\s.*_~/-]+c+[\\s.*_~/-]*l+",
      "d+[\\s.*_~/-]*[1!*@]+[\\s.*_~/-]*t+",
      "d+[\\s.*_~/-]+i+[\\s.*_~/-]*t+",
      "l+[\\s.*_~/-]*[0*@]+[\\s.*_~/-]*n+",
      "l+[\\s.*_~/-]+o+[\\s.*_~/-]*n+",
      "c+[\\s.*_~/-]*[4*@]+[\\s.*_~/-]*c+",
      "c+[\\s.*_~/-]+a+[\\s.*_~/-]*c+",
      "f+[\\s.*_~/-]*[u*@]+[\\s.*_~/-]*c+[\\s.*_~/-]*k+",
      "s+[\\s.*_~/-]*h+[\\s.*_~/-]*[1!*]+[\\s.*_~/-]*t+",
      "b+[\\s.*_~/-]*[1!*]+[\\s.*_~/-]*t+[\\s.*_~/-]*c+[\\s.*_~/-]*h+",
    ].join("|") +
    `)(?!${wordChar})`,
  "u",
);

function normalizeAccented(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .trim();
}

function normalizeFolded(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

function normalizeLeetspeak(folded: string): string {
  return folded
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    .replace(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replace(/(?<=[a-z])1(?=[a-z])/g, "i")
    .replace(/(?<=[a-z])3(?=[a-z])/g, "e")
    .replace(/(?<=[a-z])4(?=[a-z])/g, "a");
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

  const bareStandalone = accented.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "");
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
