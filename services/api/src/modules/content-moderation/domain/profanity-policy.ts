export type ProfanityRule = {
  id: string;
  term: string;
  aliases: readonly string[];
  enabled: boolean;
};

const seedTerms = [
  "địt mẹ",
  "đụ má",
  "đù má",
  "đéo",
  "vãi lồn",
  "mày ngu",
  "đồ ngu",
  "ngu như chó",
  "câm mõm",
  "ngu",
  "đù",
  "vãi",
  "vcl",
  "vl",
  "du ma",
  "dit me",
  "đ.m",
  "đ*t mẹ",
];

export const defaultProfanityRules: readonly ProfanityRule[] = seedTerms.map(
  (term, index) => ({
    id: `vi-${index + 1}`,
    term,
    aliases: [],
    enabled: true,
  }),
);

export function normalizeProfanityText(text: string): string {
  return text
    .replace(/\p{Cf}/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .trim();
}

const word = "[\\p{L}\\p{M}\\p{N}_]";

export function compileProfanityRules(rules: readonly ProfanityRule[]) {
  return rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const terms = [rule.term, ...rule.aliases]
        .map(normalizeProfanityText)
        .filter(Boolean)
        .map((term) =>
          term
            .split(/\s+/u)
            .map((part) => RegExp.escape(part))
            .join("[\\s\\p{P}]+"),
        );
      return {
        ruleId: rule.id,
        pattern: terms.length
          ? new RegExp(`(?<!${word})(?:${terms.join("|")})(?!${word})`, "u")
          : undefined,
      };
    });
}

export function matchProfanity(
  text: string,
  rules: readonly ProfanityRule[],
): { ruleId: string } | null {
  return matchCompiledProfanity(text, compileProfanityRules(rules));
}

export function matchCompiledProfanity(
  text: string,
  rules: ReturnType<typeof compileProfanityRules>,
): { ruleId: string } | null {
  const normalized = normalizeProfanityText(text);
  const match = rules.find(({ pattern }) => pattern?.test(normalized));
  return match ? { ruleId: match.ruleId } : null;
}
