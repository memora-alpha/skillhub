import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
} from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import {
  rewardProductSchema,
  redemptionSchema,
  redemptionDetailSchema,
  redemptionIntentSchema,
  type RedemptionIntent,
} from "./reward-contracts";

export function createRewardsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const receipt = (value: unknown, id?: string) => {
    // Zod strips voucher secrets: ordinary query caches hold metadata only.
    const row = parse(redemptionSchema, value);
    if (id && row.id !== id) throw new AppError("protocol");
    return row;
  };
  return {
    async products(signal?: AbortSignal) {
      return parse(
        z.array(rewardProductSchema),
        await call("/rewards/products?locale=vi", { signal }),
      );
    },
    async product(id: string, signal?: AbortSignal) {
      const row = parse(
        rewardProductSchema,
        await call(resourcePath("rewards/products", id) + "?locale=vi", {
          signal,
        }),
      );
      if (row.id !== id) throw new AppError("protocol");
      return row;
    },
    async redemptions(cursor?: string, signal?: AbortSignal) {
      return parsePage(
        redemptionSchema,
        await call(`/rewards/redemptions?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
    },
    async receipt(id: string, signal?: AbortSignal) {
      return receipt(
        await call(resourcePath("rewards/redemptions", id), {
          signal,
          replayAfterRenewal: false,
        }),
        id,
      );
    },
    async reveal(id: string, signal?: AbortSignal) {
      const row = parse(
        redemptionDetailSchema,
        await call(resourcePath("rewards/redemptions", id), {
          signal,
          replayAfterRenewal: false,
        }),
      );
      if (row.id !== id || (row.voucher && row.status !== "ISSUED"))
        throw new AppError("protocol");
      return row;
    },
    async redeem(input: RedemptionIntent) {
      const intent = parse(redemptionIntentSchema, input);
      const row = receipt(
        await call("/rewards/redemptions", {
          method: "POST",
          body: {
            productId: intent.productId,
            expectedPriceVersion: intent.expectedPriceVersion,
          },
          idempotencyKey: intent.key,
          replayAfterRenewal: false,
        }),
      );
      if (row.product.id !== intent.productId) throw new AppError("protocol");
      return row;
    },
  };
}
export type RewardsApi = ReturnType<typeof createRewardsApi>;
