import { BadRequestException } from "@nestjs/common";

export const MAX_CREDIT_UNITS = 999_999_999_999n;
const MAX_BIGINT = 9_223_372_036_854_775_807n;

export function parseCredit(value: unknown): bigint {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)
  )
    throw new BadRequestException("INVALID_CREDIT_AMOUNT");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function formatCredit(value: bigint): string;
export function formatCredit(value: null): null;
export function formatCredit(value: bigint | null): string | null;
export function formatCredit(value: bigint | null): string | null {
  if (value === null) return null;
  const magnitude = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${magnitude / 100n}.${(magnitude % 100n).toString().padStart(2, "0")}`;
}

export function feeSplit(gross: bigint): { fee: bigint; net: bigint } {
  if (gross <= 0n || gross > MAX_CREDIT_UNITS)
    throw new BadRequestException("INVALID_CREDIT_AMOUNT");
  const fee = (gross * 400n) / 10_000n;
  return { fee, net: gross - fee };
}

/** Provider may render integer VND with a zero decimal suffix; never round it. */
export function parseVnd(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}(?:\.0{1,2})?$/.test(value))
    throw new BadRequestException("INVALID_VND_AMOUNT");
  const amount = BigInt(value.split(".")[0]!);
  if (amount > MAX_BIGINT) throw new BadRequestException("INVALID_VND_AMOUNT");
  return amount;
}

export function vndToCredit(amountVnd: bigint): bigint {
  if (amountVnd <= 0n || (amountVnd * 100n) % 1000n !== 0n)
    throw new BadRequestException("UNREPRESENTABLE_CREDIT_AMOUNT");
  const units = (amountVnd * 100n) / 1000n;
  if (units > MAX_CREDIT_UNITS)
    throw new BadRequestException("INVALID_CREDIT_AMOUNT");
  return units;
}
