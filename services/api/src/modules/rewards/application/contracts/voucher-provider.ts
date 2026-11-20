export type ProviderBrand = {
  providerBrandId: string;
  nameVi: string;
  nameEn: string | null;
  logoUrl: string | null;
};

export type ProviderProduct = {
  providerProductId: string;
  providerBrandId: string;
  category: string | null;
  nameVi: string;
  nameEn: string | null;
  imageUrl: string | null;
  faceValueVnd: bigint;
  termsVi: string | null;
  termsEn: string | null;
  validityDays: number | null;
  raw: Record<string, unknown>;
};

export type IssueInput = {
  /** Redemption ID: the provider's idempotency/lookup reference. */
  clientRef: string;
  providerProductId: string;
  faceValueVnd: bigint;
};

export type IssuedVoucherData = {
  providerTransactionRef: string;
  code: string | null;
  pin: string | null;
  link: string | null;
  expiresAt: Date | null;
};

/**
 * DEFINITIVE: provider confirmed nothing was issued, so Credit may be refunded.
 * UNKNOWN: outcome not known (timeout, 5xx); never refund before reconciliation.
 */
export class VoucherProviderError extends Error {
  constructor(
    readonly kind: "DEFINITIVE" | "UNKNOWN",
    readonly code: string,
  ) {
    super(`Voucher provider ${kind}: ${code}`);
    this.name = "VoucherProviderError";
  }
}
