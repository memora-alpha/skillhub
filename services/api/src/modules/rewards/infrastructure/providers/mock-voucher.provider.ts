import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  IssueInput,
  IssuedVoucherData,
  ProviderBrand,
  ProviderProduct,
} from "../../application/contracts/voucher-provider";
import { VoucherProviderError } from "../../application/contracts/voucher-provider";
import { VoucherProvider } from "../../application/ports/voucher-provider";
import { MOCK_BRANDS, MOCK_PRODUCTS } from "./mock-catalog";

const SLOW_MS = 3000;

/**
 * Demo provider. Issued state is in memory, so a restart loses it and an unresolved
 * `-timeout`/`-lost` redemption ends in MANUAL_REVIEW, which is the intended demo path.
 */
@Injectable()
export class MockVoucherProvider extends VoucherProvider {
  readonly name = "mock" as const;
  private readonly issued = new Map<string, IssuedVoucherData>();
  private readonly timedOut = new Set<string>();

  listBrands(): Promise<ProviderBrand[]> {
    return Promise.resolve(MOCK_BRANDS);
  }

  listProducts(): Promise<ProviderProduct[]> {
    return Promise.resolve(MOCK_PRODUCTS);
  }

  async issue(input: IssueInput): Promise<IssuedVoucherData> {
    const existing = this.issued.get(input.clientRef);
    if (existing) return existing;
    const id = input.providerProductId;
    if (id.endsWith("-oos"))
      throw new VoucherProviderError("DEFINITIVE", "OUT_OF_STOCK");
    if (id.endsWith("-err"))
      throw new VoucherProviderError("DEFINITIVE", "PROVIDER_REJECTED");
    if (id.endsWith("-lost"))
      throw new VoucherProviderError("UNKNOWN", "PROVIDER_TIMEOUT");
    if (id.endsWith("-timeout") && !this.timedOut.has(input.clientRef)) {
      // The provider processed the request but the response was lost.
      this.timedOut.add(input.clientRef);
      this.store(input);
      throw new VoucherProviderError("UNKNOWN", "PROVIDER_TIMEOUT");
    }
    if (id.endsWith("-slow"))
      await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    return this.store(input);
  }

  findByClientRef(clientRef: string): Promise<IssuedVoucherData | null> {
    return Promise.resolve(this.issued.get(clientRef) ?? null);
  }

  private store(input: IssueInput): IssuedVoucherData {
    const part = () => randomBytes(2).toString("hex").toUpperCase();
    const data: IssuedVoucherData = {
      providerTransactionRef: `mock-${input.clientRef}`,
      code: `DEMO-${part()}-${part()}`,
      pin: null,
      link: null,
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    };
    this.issued.set(input.clientRef, data);
    return data;
  }
}
