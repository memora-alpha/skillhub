import type { ApiMaterial } from "../../src/features/materials/api/material-contracts";
export const materialOwnerId = "123e4567-e89b-42d3-a456-000000000001";
export const materialOtherId = "123e4567-e89b-42d3-a456-000000000002";
export function fixtureMaterial(
  overrides: Partial<ApiMaterial> = {},
): ApiMaterial {
  const status = overrides.status ?? "DRAFT";
  const hasBeenPublished =
    overrides.hasBeenPublished ??
    (status === "PUBLISHED" || status === "ARCHIVED");
  const editBlockedReason = hasBeenPublished
    ? "MATERIAL_CONTENT_LOCKED"
    : status === "DRAFT" || status === "REJECTED"
      ? null
      : "MATERIAL_NOT_EDITABLE";
  return {
    id: "123e4567-e89b-42d3-a456-000000000010",
    ownerId: materialOwnerId,
    skillId: "123e4567-e89b-42d3-a456-000000000020",
    title: "Tài liệu giao tiếp tiếng Anh",
    description: "Bài tập thực hành giao tiếp theo các tình huống thường gặp.",
    accessType: "FREE",
    priceCredit: "0.00",
    listingVersion: 1,
    status: "DRAFT",
    file: {
      originalFilename: "giao-tiep.pdf",
      mimeType: "application/pdf",
      sizeBytes: "1250000",
    },
    createdAt: "2026-11-13T08:00:00Z",
    updatedAt: "2026-11-13T08:00:00Z",
    scanStatus: "CLEAN",
    moderationStatus: "NONE",
    rejectReason: null,
    reviewedAt: null,
    distributionRightsConfirmedAt: "2026-11-13T08:00:00Z",
    hasBeenPublished,
    canEdit: editBlockedReason === null,
    editBlockedReason,
    ...overrides,
  };
}
