import { z } from "zod";
import {
  defaultProfanityRules,
  normalizeProfanityText,
} from "./profanity-policy";

export const profanityConfigurationKey = "contentModeration.profanityRuleSet";
const term = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) =>
    normalizeProfanityText(value)
      .split(/\s+/u)
      .every((part) => /^[\p{L}\p{N}]/u.test(part)),
  );

export const profanityRuleSetSchema = z
  .object({
    rules: z
      .array(
        z
          .object({
            id: z
              .string()
              .trim()
              .min(1)
              .max(64)
              .regex(/^[\w-]+$/u),
            term,
            aliases: z.array(term).max(20),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(250),
  })
  .strict()
  .superRefine(({ rules }, context) => {
    const ids = new Set<string>();
    const terms = new Set<string>();
    rules.forEach((rule, index) => {
      if (ids.has(rule.id))
        context.addIssue({
          code: "custom",
          path: ["rules", index, "id"],
          message: "DUPLICATE_ID",
        });
      ids.add(rule.id);
      for (const [position, value] of [rule.term, ...rule.aliases].entries()) {
        const normalized = normalizeProfanityText(value).replace(/\s+/gu, " ");
        if (terms.has(normalized))
          context.addIssue({
            code: "custom",
            path:
              position === 0
                ? ["rules", index, "term"]
                : ["rules", index, "aliases", position - 1],
            message: "DUPLICATE_TERM",
          });
        terms.add(normalized);
      }
    });
  });

export const defaultProfanityRuleSet = {
  rules: defaultProfanityRules.map((rule) => ({
    ...rule,
    aliases: [...rule.aliases],
  })),
};
