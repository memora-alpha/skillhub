import type {
  IssueInput,
  IssuedVoucherData,
  ProviderBrand,
  ProviderProduct,
} from "../contracts/voucher-provider";

export abstract class VoucherProvider {
  abstract readonly name: "mock" | "gotit";
  abstract listBrands(): Promise<ProviderBrand[]>;
  abstract listProducts(): Promise<ProviderProduct[]>;
  /** Throws VoucherProviderError. Must be idempotent per clientRef. */
  abstract issue(input: IssueInput): Promise<IssuedVoucherData>;
  /** null: the provider has no record of clientRef. */
  abstract findByClientRef(
    clientRef: string,
  ): Promise<IssuedVoucherData | null>;
}
