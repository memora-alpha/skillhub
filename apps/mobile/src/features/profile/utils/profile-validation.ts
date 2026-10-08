import type { ProfileDraft, ProfileErrors } from "../types/profile";

// Match the installed backend validator; names use code-point length instead.
export function profileTextLength(value: string): number {
  const selectors = value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)?.length ?? 0;
  const pairs = value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0;
  return value.length - selectors - pairs;
}

export function validateProfileDraft(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = draft.fullName.trim();
  if (Array.from(name).length < 2 || Array.from(name).length > 100)
    errors.fullName = "Tên hiển thị cần từ 2 đến 100 ký tự.";
  else if (!/\p{L}/u.test(name) || !/^[\p{L}\p{M} '\u2019-]+$/u.test(name))
    errors.fullName = "Tên chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.";
  if (profileTextLength(draft.headline) > 120)
    errors.headline = "Dòng giới thiệu tối đa 120 ký tự.";
  if (profileTextLength(draft.bio) > 1000)
    errors.bio = "Giới thiệu bản thân tối đa 1.000 ký tự.";
  return errors;
}

export function profileHasChanges(
  saved: ProfileDraft,
  draft: ProfileDraft,
): boolean {
  return (
    saved.fullName !== draft.fullName.trim() ||
    saved.headline !== draft.headline ||
    saved.bio !== draft.bio
  );
}
