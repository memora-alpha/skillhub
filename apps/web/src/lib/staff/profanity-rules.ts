export type ProfanityRule = {
  id: string;
  term: string;
  aliases: string[];
  enabled: boolean;
};

export const maxProfanityRules = 250;
export const maxProfanityTermLength = 120;
export const maxProfanityAliases = 20;

const tokenStartsWithAlnum = /^[\p{L}\p{N}]/u;
const validRuleId = /^[\w-]{1,64}$/u;

export function normalizeProfanityTerm(value: string): string {
  return value
    .normalize("NFKC")
    .replaceAll(/\p{Cf}/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(/\s+/gu, " ")
    .trim();
}

export function validateProfanityTerm(
  value: string,
  label: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `Vui lòng nhập ${label.toLowerCase()}.`;
  if (trimmed.length > maxProfanityTermLength) {
    return `${label} không được vượt quá ${maxProfanityTermLength} ký tự.`;
  }
  const normalized = normalizeProfanityTerm(trimmed);
  if (!normalized) return `Vui lòng nhập ${label.toLowerCase()}.`;
  const tokens = normalized.split(" ");
  if (!tokens.every((token) => tokenStartsWithAlnum.test(token))) {
    return `${label} không hợp lệ: mỗi từ phải bắt đầu bằng chữ cái hoặc chữ số.`;
  }
  return null;
}

function indexOtherTerms(
  rules: readonly ProfanityRule[],
  excludeRuleId?: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const rule of rules) {
    if (excludeRuleId && rule.id === excludeRuleId) continue;
    for (const raw of [rule.term, ...rule.aliases]) {
      const key = normalizeProfanityTerm(raw);
      if (key && !map.has(key)) map.set(key, rule.term.trim() || raw.trim());
    }
  }
  return map;
}

export function validateProfanityRuleDraft(
  draft: { id?: string; term: string; aliases: readonly string[] },
  existingRules: readonly ProfanityRule[],
): string | null {
  const termError = validateProfanityTerm(draft.term, "Từ hoặc cụm từ chính");
  if (termError) return termError;

  const cleanAliases = draft.aliases.map((item) => item.trim()).filter(Boolean);
  if (cleanAliases.length > maxProfanityAliases) {
    return `Mỗi quy tắc chỉ hỗ trợ tối đa ${maxProfanityAliases} biến thể.`;
  }

  const otherTerms = indexOtherTerms(existingRules, draft.id);
  const localTerms = new Set<string>();

  const normalizedTerm = normalizeProfanityTerm(draft.term);
  const termConflict = otherTerms.get(normalizedTerm);
  if (termConflict) {
    return `Từ “${draft.term.trim()}” bị trùng với quy tắc “${termConflict}” hiện có.`;
  }
  localTerms.add(normalizedTerm);

  for (const [index, alias] of cleanAliases.entries()) {
    const aliasLabel = `Biến thể dòng ${index + 1}`;
    const aliasError = validateProfanityTerm(alias, aliasLabel);
    if (aliasError) return aliasError;

    const normalizedAlias = normalizeProfanityTerm(alias);
    if (localTerms.has(normalizedAlias)) {
      return `${aliasLabel} (“${alias}”) bị trùng với từ chính hoặc biến thể khác trong cùng quy tắc.`;
    }
    const conflict = otherTerms.get(normalizedAlias);
    if (conflict) {
      return `${aliasLabel} (“${alias}”) bị trùng với quy tắc “${conflict}” hiện có.`;
    }
    localTerms.add(normalizedAlias);
  }

  return null;
}

export function validateProfanityRuleSet(
  rules: readonly ProfanityRule[],
): string | null {
  if (rules.length < 1 || rules.length > maxProfanityRules) {
    return `Bộ lọc cần giữ từ 1 đến ${maxProfanityRules} quy tắc.`;
  }
  const seenIds = new Set<string>();
  const seenTerms = new Map<string, string>();

  for (const [ruleIndex, rule] of rules.entries()) {
    const id = rule.id.trim();
    if (!validRuleId.test(id)) {
      return `Quy tắc #${ruleIndex + 1} có mã định danh không hợp lệ.`;
    }
    if (seenIds.has(id)) {
      return `Quy tắc #${ruleIndex + 1} có mã định danh bị trùng.`;
    }
    seenIds.add(id);

    const termLabel = `Quy tắc #${ruleIndex + 1}`;
    const termError = validateProfanityRuleTerms(rule, termLabel, seenTerms);
    if (termError) return termError;
  }

  return null;
}

function validateProfanityRuleTerms(
  rule: ProfanityRule,
  termLabel: string,
  seenTerms: Map<string, string>,
): string | null {
  const termError = validateProfanityTerm(rule.term, termLabel);
  if (termError) return termError;

  const cleanAliases = rule.aliases.map((item) => item.trim()).filter(Boolean);
  if (cleanAliases.length > maxProfanityAliases) {
    return `${termLabel} (“${rule.term.trim()}”) vượt quá ${maxProfanityAliases} biến thể.`;
  }

  for (const [position, raw] of [rule.term, ...cleanAliases].entries()) {
    const label =
      position === 0
        ? termLabel
        : `Biến thể #${position} của quy tắc “${rule.term.trim()}”`;
    if (position > 0) {
      const aliasError = validateProfanityTerm(raw, label);
      if (aliasError) return aliasError;
    }
    const key = normalizeProfanityTerm(raw);
    const existing = seenTerms.get(key);
    if (existing) {
      return `Từ/biến thể “${raw.trim()}” bị trùng với quy tắc “${existing}”.`;
    }
    seenTerms.set(key, rule.term.trim());
  }
  return null;
}
