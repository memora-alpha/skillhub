import type { ModerationRules } from "./admin-types";
type Rule = ModerationRules["rules"][number];
export type EditableRule = Rule & { readonly id: string };
export function editableRules(rules: readonly Rule[]): EditableRule[] {
  return rules.map((rule) => ({ ...rule, id: crypto.randomUUID() }));
}
export function ruleValues(rules: readonly EditableRule[]): Rule[] {
  return rules.map(({ category, pattern }) => ({ category, pattern }));
}
export function validateRules(rules: readonly Rule[]): string | null {
  if (!rules.length || rules.length > 250) return "Cần từ 1 đến 250 quy tắc.";
  const pairs = new Set<string>();
  for (const rule of rules) {
    const category = rule.category.trim().toUpperCase();
    const pattern = rule.pattern
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/gu, " ")
      .trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(category))
      return "Nhóm quy tắc bắt đầu bằng chữ, tối đa 64 ký tự; chỉ dùng chữ, số, dấu _ hoặc -.";
    const wildcards = [...pattern].filter(
      (character) => character === "*",
    ).length;
    if (
      pattern.length > 120 ||
      [...pattern].length - wildcards < 2 ||
      wildcards > 1
    )
      return "Mẫu cần ít nhất 2 ký tự ngoài dấu *, tối đa 120 ký tự và tối đa một dấu *.";
    const key = `${category}\u0000${pattern}`;
    if (pairs.has(key)) return "Có quy tắc trùng nhóm và mẫu sau chuẩn hóa.";
    pairs.add(key);
  }
  return null;
}
