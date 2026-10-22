import { BadRequestException, ConflictException } from "@nestjs/common";
import type { RoleCode } from "../../../shared/authorization/authorization.types";
import type { PermissionCode } from "../../../shared/authorization/permission.catalog";
import { parseCredit } from "../../credit/domain/money";

export type MaterialAccess = "FREE" | "PAID";
export type MaterialState =
  "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "HIDDEN" | "ARCHIVED";
export type ModerationAction = "approve" | "reject" | "hide" | "unhide";

export const MATERIAL_PERMISSIONS = {
  USER: ["material:create:self", "material:access"],
  STAFF: ["material:create:self", "material:access", "material:moderate"],
  ADMIN: ["material:create:self", "material:access", "material:moderate"],
} satisfies Record<RoleCode, readonly PermissionCode[]>;

/**
 * SRS 18.41: title 5–150, description 10–3000 after trimming. Lengths count code
 * points so they agree with the PostgreSQL char_length CHECK (an emoji is one).
 */
export function listingText(input: { title: string; description: string }) {
  const title = input.title.trim();
  const description = input.description.trim();
  const titleLength = [...title].length;
  const descriptionLength = [...description].length;
  if (
    titleLength < 5 ||
    titleLength > 150 ||
    descriptionLength < 10 ||
    descriptionLength > 3000
  )
    throw new BadRequestException("MATERIAL_TEXT_INVALID");
  return { title, description };
}

/** BR-42: FREE is exactly 0, PAID is > 0 with at most two decimals. Returns hundredths. */
export function priceUnits(accessType: MaterialAccess, price: string): bigint {
  let units: bigint;
  try {
    units = parseCredit(price);
  } catch {
    throw new BadRequestException("MATERIAL_PRICE_INVALID");
  }
  const valid = accessType === "FREE" ? units === 0n : units > 0n;
  if (!valid) throw new BadRequestException("MATERIAL_PRICE_INVALID");
  return units;
}

const EDITABLE: ReadonlySet<MaterialState> = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
]);

/** D3: a live listing goes back to review; a rejected one becomes a draft again. */
export function statusAfterEdit(status: MaterialState): MaterialState {
  if (!EDITABLE.has(status))
    throw new ConflictException("MATERIAL_NOT_EDITABLE");
  if (status === "PUBLISHED") return "PENDING_REVIEW";
  if (status === "REJECTED") return "DRAFT";
  return status;
}

/** Owners may stop distributing anything they could still edit; HIDDEN stays with Staff. */
export function assertArchivable(status: MaterialState): void {
  if (!EDITABLE.has(status))
    throw new ConflictException("MATERIAL_TRANSITION_INVALID");
}

const MODERATION: Record<
  ModerationAction,
  { from: readonly MaterialState[]; to: MaterialState; decision: string }
> = {
  approve: { from: ["PENDING_REVIEW"], to: "PUBLISHED", decision: "APPROVED" },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED", decision: "REJECTED" },
  hide: {
    from: ["PENDING_REVIEW", "PUBLISHED"],
    to: "HIDDEN",
    decision: "HIDDEN",
  },
  unhide: { from: ["HIDDEN"], to: "PUBLISHED", decision: "APPROVED" },
};

export const MODERATION_ACTIONS = Object.keys(MODERATION) as ModerationAction[];

export function moderationTransition(
  action: ModerationAction,
  status: MaterialState,
): { status: MaterialState; decision: string } {
  const rule = MODERATION[action];
  if (!rule.from.includes(status))
    throw new ConflictException("MATERIAL_TRANSITION_INVALID");
  return { status: rule.to, decision: rule.decision };
}

/** Mirrors the materials_published_file_check constraint. */
export function assertPublishableFile(material: {
  storageKey: string | null;
  scanStatus: string | null;
  distributionRightsConfirmedAt: Date | null;
}): void {
  if (
    !material.storageKey ||
    material.scanStatus !== "CLEAN" ||
    !material.distributionRightsConfirmedAt
  )
    throw new ConflictException("MATERIAL_FILE_REQUIRED");
}

/** D2: the fee floors to hundredths and the seller receives the remainder. */
export function materialFee(
  gross: bigint,
  feeBps: unknown,
): { fee: bigint; net: bigint } {
  if (
    gross <= 0n ||
    typeof feeBps !== "number" ||
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps >= 10_000
  )
    throw new ConflictException("MATERIAL_FEE_POLICY_UNAVAILABLE");
  const fee = (gross * BigInt(feeBps)) / 10_000n;
  return { fee, net: gross - fee };
}

/** Stored on MaterialOrder.purchasedFileSnapshot (ERD v3: no MaterialVersion). */
export type PurchasedFileSnapshot = {
  storageKey: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  checksum: string | null;
  distributionRightsConfirmedAt: string | null;
  uploadedAt: string | null;
};

export function snapshotStorageKey(snapshot: unknown): string {
  const key = (snapshot as { storageKey?: unknown } | null)?.storageKey;
  if (typeof key !== "string" || key.length === 0)
    throw new ConflictException("MATERIAL_FILE_REQUIRED");
  return key;
}
