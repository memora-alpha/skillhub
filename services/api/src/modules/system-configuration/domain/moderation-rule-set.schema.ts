import { z } from "zod";

const normalize = (value: string): string =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

const patternSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform(normalize)
  .refine((pattern) => {
    const wildcards = [...pattern].filter(
      (character) => character === "*",
    ).length;
    const literalCharacters = [...pattern].filter(
      (character) => character !== "*",
    ).length;
    return wildcards <= 1 && literalCharacters >= 2;
  });

const ruleSchema = z.strictObject({
  category: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
    .transform((category) => category.toUpperCase()),
  pattern: patternSchema,
});

export const moderationRuleSetSchema = z
  .strictObject({ rules: z.array(ruleSchema).max(250) })
  .refine(({ rules }) => {
    const unique = new Set(
      rules.map((rule) => `${rule.category}\u0000${rule.pattern}`),
    );
    return unique.size === rules.length;
  });

export type ModerationRuleSet = z.output<typeof moderationRuleSetSchema>;
