import { z } from "zod";
import { timestamp, uuid, version } from "@/lib/http/contracts";
export const credit = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
export const materialSchema = z.object({
  id: uuid,
  ownerId: uuid,
  skillId: uuid,
  title: z.string(),
  description: z.string(),
  accessType: z.enum(["FREE", "PAID"]),
  priceCredit: credit,
  listingVersion: version,
  status: z.enum([
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "REJECTED",
    "HIDDEN",
    "ARCHIVED",
  ]),
  file: z
    .object({
      originalFilename: z.string().nullable(),
      mimeType: z.string(),
      sizeBytes: z.string().regex(/^\d+$/).nullable(),
    })
    .nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  scanStatus: z.string().optional(),
  moderationStatus: z.string().optional(),
  rejectReason: z.string().nullable().optional(),
  distributionRightsConfirmedAt: timestamp.nullable().optional(),
});
export const orderSchema = z.object({
  id: uuid,
  materialId: uuid,
  sellerId: uuid,
  listingVersion: version,
  grossCredit: credit,
  feeAmount: credit,
  sellerNetCredit: credit,
  status: z.enum(["SUCCESS", "REFUNDED"]),
  createdAt: timestamp,
});
export const materialInput = z
  .object({
    skillId: uuid,
    title: z.string().trim().min(5).max(150),
    description: z.string().trim().min(10).max(3000),
    accessType: z.enum(["FREE", "PAID"]),
    priceCredit: credit,
    distributionRightsConfirmed: z.literal(true),
    fileId: uuid.optional(),
  })
  .refine((v) =>
    v.accessType === "FREE"
      ? Number(v.priceCredit) === 0
      : Number(v.priceCredit) > 0,
  );
export const downloadSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }),
  expiresAt: timestamp,
});
export type ApiMaterial = z.infer<typeof materialSchema>;
export type MaterialOrder = z.infer<typeof orderSchema>;
export type MaterialInput = z.infer<typeof materialInput>;
