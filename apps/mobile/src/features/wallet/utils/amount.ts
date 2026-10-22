import type { CreditAmount, CreditDelta, VndAmount } from "../types/wallet";

function exactText(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || value.match(pattern)?.[0] !== value)
    throw new TypeError("Invalid exact monetary text");
  return value;
}
export function creditAmount(value: unknown): CreditAmount {
  return exactText(value, /^(?:0|[1-9]\d*)\.\d{2}$/) as CreditAmount;
}
export function creditDelta(value: unknown): CreditDelta {
  const text = exactText(value, /^-?(?:0|[1-9]\d*)\.\d{2}$/);
  return (text === "-0.00" ? "0.00" : text) as CreditDelta;
}
export function vndAmount(value: unknown): VndAmount {
  return exactText(value, /^[1-9]\d*$/) as VndAmount;
}
function groupDigits(text: string) {
  const groups: string[] = [];
  const first = text.length % 3 || 3;
  groups.push(text.slice(0, first));
  for (let index = first; index < text.length; index += 3)
    groups.push(text.slice(index, index + 3));
  return groups.join(".");
}
export function formatCredit(value: unknown, { signed = false } = {}): string {
  const text = signed ? creditDelta(value) : creditAmount(value);
  const negative = text.startsWith("-");
  const [whole, fraction] = (negative ? text.slice(1) : text).split(".");
  let sign = "";
  if (negative) sign = "-";
  else if (signed && text !== "0.00") sign = "+";
  return `${sign}${groupDigits(whole!)},${fraction} CR`;
}
export function formatVnd(value: unknown): string {
  return `${groupDigits(vndAmount(value))} VND`;
}
