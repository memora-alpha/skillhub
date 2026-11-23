import { z } from "zod";
import { timestamp, uuid, version } from "@/lib/http/contracts";

const credit = z.string().regex(/^(?:0|[1-9]\d{0,12})\.\d{2}$/);
const vnd = z.string().regex(/^[1-9]\d{0,15}$/);
const image = z.string().nullable();
export const rewardProductSchema = z.object({
  id: uuid,
  name: z.string(),
  imageUrl: image,
  category: z.string().nullable(),
  brand: z.object({ id: uuid, name: z.string(), logoUrl: image }),
  faceValueVnd: vnd,
  priceCredit: credit,
  priceVersion: version,
  terms: z.string().nullable(),
  validityDays: z.number().int().positive().nullable(),
  status: z.literal("ACTIVE"),
  sortOrder: z.number().int(),
});
const redemptionStatusSchema = z.enum([
  "ISSUING",
  "ISSUED",
  "FAILED_REFUNDED",
  "MANUAL_REVIEW",
  "REFUNDED_MANUAL",
]);
export const redemptionSchema = z.object({
  id: uuid,
  status: redemptionStatusSchema,
  priceCredit: credit,
  faceValueVnd: vnd,
  product: z.object({
    id: uuid,
    name: z.string(),
    imageUrl: image,
    brandName: z.string(),
    brandLogoUrl: image,
  }),
  createdAt: timestamp,
  resolvedAt: timestamp.nullable(),
  expiresAt: timestamp.nullable(),
});
export const voucherSecretSchema = z.object({
  code: z.string().nullable(),
  pin: z.string().nullable(),
  link: z.string().nullable(),
});
export const redemptionDetailSchema = redemptionSchema.extend({
  voucher: voucherSecretSchema.nullable(),
});
export const redemptionIntentSchema = z.object({
  key: uuid,
  productId: uuid,
  expectedPriceVersion: version,
});
export type RewardProduct = z.infer<typeof rewardProductSchema>;
export type Redemption = z.infer<typeof redemptionSchema>;
export type RedemptionStatus = z.infer<typeof redemptionStatusSchema>;
export type VoucherSecret = z.infer<typeof voucherSecretSchema>;
export type RedemptionIntent = z.infer<typeof redemptionIntentSchema>;
