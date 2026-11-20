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
      const syncedAt = new Date();
      const listed = products.filter((product) =>
        brandIds.has(product.providerBrandId),
      );
      // One read for every listed product instead of a lookup per product.
      const existing = new Map(
        (
          await tx.rewardProduct.findMany({
            where: {
              provider,
              providerProductId: {
                in: listed.map((product) => product.providerProductId),
              },
            },
          })
        ).map((row) => [row.providerProductId, row]),
      );
      const fieldsOf = (product: (typeof listed)[number]) => ({
        brandId: brandIds.get(product.providerBrandId) as string,
        category: product.category,
        nameVi: product.nameVi,
        nameEn: product.nameEn,
        imageUrl: product.imageUrl,
        faceValueVnd: product.faceValueVnd,
        termsVi: product.termsVi,
        termsEn: product.termsEn,
        validityDays: product.validityDays,
        rawPayload: product.raw as Prisma.InputJsonObject,
        syncedAt,
      });
      await tx.rewardProduct.createMany({
        data: listed
          .filter((product) => !existing.has(product.providerProductId))
          .map((product) => ({
            provider,
            providerProductId: product.providerProductId,
            ...fieldsOf(product),
          })),
      });
      // Sequential: every row gets its own values, and the transaction owns one connection.
      for (const product of listed) {
        const current = existing.get(product.providerProductId);
        if (!current) continue;
        await tx.rewardProduct.update({
          where: { id: current.id },
          data: {
            ...fieldsOf(product),
            // A removed product that reappears returns INACTIVE; an admin reactivates it.
            ...(current.status === "REMOVED"
              ? { status: "INACTIVE" as const }
              : {}),
          },
        });
      }
      const upserted = listed.length;
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
