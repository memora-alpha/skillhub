export function validFullName(value: string): boolean {
  const name = value.trim();
  return (
    Array.from(name).length >= 2 &&
    Array.from(name).length <= 100 &&
    /\p{L}/u.test(name) &&
    /^[\p{L}\p{M} '’\-]+$/u.test(name)
  );
}
