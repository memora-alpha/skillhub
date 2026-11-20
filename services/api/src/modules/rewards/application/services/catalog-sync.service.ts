import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { VoucherProvider } from "../ports/voucher-provider";

/**
 * Upserts provider brands/products. New products start INACTIVE and unpriced; products the
 * provider no longer lists become REMOVED (never deleted: redemptions reference them).
 */
@Injectable()
export class CatalogSyncService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly provider: VoucherProvider,
  ) {}

  async sync(): Promise<{ brands: number; products: number; removed: number }> {
    const [brands, products] = await Promise.all([
      this.provider.listBrands(),
      this.provider.listProducts(),
    ]);
    const provider = this.provider.name;
    return this.transactions.run(async (tx) => {
      const brandIds = new Map<string, string>();
      // Sequential: the transaction owns one connection.
      for (const brand of brands) {
        const row = await tx.rewardBrand.upsert({
          where: {
            provider_providerBrandId: {
              provider,
              providerBrandId: brand.providerBrandId,
            },
          },
          create: { provider, ...brand },
          update: {
            nameVi: brand.nameVi,
            nameEn: brand.nameEn,
            logoUrl: brand.logoUrl,
            status: "ACTIVE",
            syncedAt: new Date(),
          },
        });
        brandIds.set(brand.providerBrandId, row.id);
      }
      let upserted = 0;
      for (const product of products) {
        const brandId = brandIds.get(product.providerBrandId);
        if (!brandId) continue;
        const fields = {
          brandId,
          category: product.category,
          nameVi: product.nameVi,
          nameEn: product.nameEn,
          imageUrl: product.imageUrl,
          faceValueVnd: product.faceValueVnd,
          termsVi: product.termsVi,
          termsEn: product.termsEn,
          validityDays: product.validityDays,
          rawPayload: product.raw as Prisma.InputJsonObject,
          syncedAt: new Date(),
        };
        const existing = await tx.rewardProduct.findUnique({
          where: {
            provider_providerProductId: {
              provider,
              providerProductId: product.providerProductId,
            },
          },
        });
        if (!existing) {
          await tx.rewardProduct.create({
            data: {
              provider,
              providerProductId: product.providerProductId,
              ...fields,
            },
          });
        } else {
          // A removed product that reappears returns INACTIVE; an admin reactivates it.
          await tx.rewardProduct.update({
            where: { id: existing.id },
            data: {
              ...fields,
              ...(existing.status === "REMOVED"
                ? { status: "INACTIVE" as const }
                : {}),
            },
          });
        }
        upserted += 1;
      }
      const removed = await tx.rewardProduct.updateMany({
        where: {
          provider,
          status: { not: "REMOVED" },
          providerProductId: {
            notIn: products.map((product) => product.providerProductId),
          },
        },
        data: { status: "REMOVED", priceVersion: { increment: 1 } },
      });
      return {
        brands: brands.length,
        products: upserted,
        removed: removed.count,
      };
    });
  }
}
