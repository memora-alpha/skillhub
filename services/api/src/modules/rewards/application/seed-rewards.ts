import type { PrismaClient } from "../../../generated/prisma/client";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import { parseCredit } from "../../credit/domain/money";
import { MockVoucherProvider } from "../infrastructure/providers/mock-voucher.provider";
import { CatalogSyncService } from "./services/catalog-sync.service";

export type RewardSeedResult = {
  brands: number;
  products: number;
  removed: number;
  activated: number;
};

/**
 * The catalog carries real brand names with worthless mock vouchers, so it may only be
 * loaded where the deployment tier says so. An unset tier counts as production.
 */
export function assertRewardSeedAllowed(
  env: Record<string, string | undefined>,
): void {
  const tier = env.APP_DEPLOYMENT_TIER ?? "production";
  if (tier !== "local" && tier !== "staging")
    throw new Error(
      "REWARD_SEED_REFUSED: set APP_DEPLOYMENT_TIER to local or staging",
    );
}

/**
 * Loads the mock provider's catalog like an admin sync would. With `activate`, products that
 * still have no price get their demo price and become ACTIVE. Prices an admin already set
 * are never changed, so the script is safe to run again.
 */
export async function seedRewardCatalog(
  prisma: PrismaClient,
  options: { activate: boolean },
): Promise<RewardSeedResult> {
  const provider = new MockVoucherProvider();
  const transactions = new TransactionRunner(prisma);
  const synced = await new CatalogSyncService(transactions, provider).sync();
  if (!options.activate) return { ...synced, activated: 0 };

  const suggested = new Map<string, bigint>();
  for (const product of await provider.listProducts()) {
    const price = product.raw.suggestedPriceCredit;
    if (typeof price === "string")
      suggested.set(product.providerProductId, parseCredit(price));
  }
  const activated = await transactions.run(async (tx) => {
    const pending = await tx.rewardProduct.findMany({
      where: { provider: provider.name, status: "INACTIVE", priceCredit: null },
      select: { id: true, providerProductId: true },
    });
    // One update per distinct price instead of one per product.
    const idsByPrice = new Map<bigint, string[]>();
    for (const row of pending) {
      const price = suggested.get(row.providerProductId);
      if (price === undefined) continue;
      idsByPrice.set(price, [...(idsByPrice.get(price) ?? []), row.id]);
    }
    let count = 0;
    // Sequential: the transaction owns one connection.
    for (const [price, ids] of idsByPrice) {
      const result = await tx.rewardProduct.updateMany({
        where: { id: { in: ids }, status: "INACTIVE", priceCredit: null },
        data: {
          priceCredit: price,
          status: "ACTIVE",
          priceVersion: { increment: 1 },
        },
      });
      count += result.count;
    }
    return count;
  });
  return { ...synced, activated };
}
