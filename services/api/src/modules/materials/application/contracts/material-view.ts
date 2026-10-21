import type {
  Material,
  MaterialOrder,
} from "../../../../generated/prisma/client";
import { formatCredit } from "../../../credit/domain/money";

/** Metadata/preview only; the storage key never leaves the API (FR-MAT-03). */
export function publicMaterialView(material: Material) {
  return {
    id: material.id,
    ownerId: material.ownerId,
    skillId: material.skillId,
    title: material.title,
    description: material.description,
    accessType: material.accessType,
    priceCredit: formatCredit(material.priceCredit),
    listingVersion: material.listingVersion,
    status: material.status,
    file: material.mimeType
      ? {
          originalFilename: material.originalFilename,
          mimeType: material.mimeType,
          sizeBytes: material.sizeBytes?.toString() ?? null,
        }
      : null,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

/** Owner and moderator projection: adds review state, still no storage key. */
export function ownerMaterialView(material: Material) {
  return {
    ...publicMaterialView(material),
    scanStatus: material.scanStatus,
    moderationStatus: material.moderationStatus,
    rejectReason: material.rejectReason,
    reviewedAt: material.reviewedAt,
    distributionRightsConfirmedAt: material.distributionRightsConfirmedAt,
  };
}

export function orderView(order: MaterialOrder) {
  return {
    id: order.id,
    materialId: order.materialId,
    sellerId: order.sellerId,
    listingVersion: order.listingVersion,
    grossCredit: formatCredit(order.grossCredit),
    feeAmount: formatCredit(order.feeAmount),
    sellerNetCredit: formatCredit(order.sellerNetCredit),
    status: order.status,
    createdAt: order.createdAt,
  };
}
