export type FeeRatePresentation = Readonly<{
  fee: string;
  returned: string;
}>;

export function feeRatePresentation(
  rate: string | null | undefined,
): FeeRatePresentation | null {
  if (rate === null || rate === undefined) return null;
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
  const bps = Math.round(value * 10_000);
  return {
    fee: `${bps / 100}%`,
    returned: `${(10_000 - bps) / 100}%`,
  };
}
