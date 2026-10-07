import { ServiceUnavailableException } from "@nestjs/common";
import {
  moderationRuleSetSchema,
  type ModerationRuleSet,
} from "../../system-configuration/domain/moderation-rule-set.schema";

export type ModerationContent = {
  title: string;
  description: string;
  learningGoal: string;
  tags: readonly string[];
};

export type ModerationRuleSnapshot = {
  ruleSet: unknown;
  version: number;
};

export type ModerationResult = {
  flagged: boolean;
  categories: string[];
  ruleSetVersion: number;
};

export function normalizeRequestText(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function matches(text: string, pattern: string): boolean {
  const wildcardAt = pattern.indexOf("*");
  if (wildcardAt < 0) return text.includes(pattern);
  const before = pattern.slice(0, wildcardAt);
  const after = pattern.slice(wildcardAt + 1);
  const beforeAt = before ? text.indexOf(before) : 0;
  if (beforeAt < 0) return false;
  return (
    after.length === 0 || text.indexOf(after, beforeAt + before.length) >= 0
  );
}

export function evaluateModeration(
  content: ModerationContent,
  snapshot: ModerationRuleSnapshot | null | undefined,
): ModerationResult {
  let parsed: ModerationRuleSet;
  try {
    if (
      !snapshot ||
      !Number.isSafeInteger(snapshot.version) ||
      snapshot.version < 1
    ) {
      throw new TypeError("invalid moderation snapshot");
    }
    parsed = moderationRuleSetSchema.parse(snapshot.ruleSet);
    if (parsed.rules.length === 0) throw new TypeError("empty rule set");
  } catch {
    throw new ServiceUnavailableException("Moderation rules unavailable");
  }

  const texts = [
    content.title,
    content.description,
    content.learningGoal,
    ...content.tags,
  ].map(normalizeRequestText);
  const categories = new Set<string>();
  for (const rule of parsed.rules) {
    if (texts.some((text) => matches(text, rule.pattern))) {
      categories.add(rule.category);
    }
  }
  const sortedCategories = [...categories].sort();
  return {
    flagged: sortedCategories.length > 0,
    categories: sortedCategories,
    ruleSetVersion: snapshot.version,
  };
}
