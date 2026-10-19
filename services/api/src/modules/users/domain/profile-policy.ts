export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();
export const validPassword = (value: string): boolean =>
  value.length >= 8 &&
  value.length <= 64 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9\s]/.test(value);
export const validFullName = (value: string): boolean =>
  Array.from(value).length >= 2 &&
  Array.from(value).length <= 100 &&
  /\p{L}/u.test(value) &&
  /^[\p{L}\p{M} '\u2019-]+$/u.test(value) &&
  value === value.trim();
export function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
