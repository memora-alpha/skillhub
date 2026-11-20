import { ForbiddenException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  RewardBrand,
  RewardProduct,
} from "../../../../generated/prisma/client";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
import { formatCredit } from "../../../credit/domain/money";
import { roleCodes } from "../../../../shared/authorization/principal-actor";
import type { Principal } from "../../../auth/application/services/sessions.service";

export type Locale = "vi" | "en";

export function requireReward(principal: Principal, code: PermissionCode) {
  if (!principal.permissions.includes(code))
    throw new ForbiddenException("REWARD_PERMISSION_REQUIRED");
}

export function humanActor(principal: Principal) {
  return {
    kind: "HUMAN" as const,
    userId: principal.userId,
    roles: roleCodes(principal),
  };
}

export function auditContext() {
  return { requestId: randomUUID(), correlationId: randomUUID() };
}

/** Vietnam calendar day start (UTC+7, no DST) as a UTC instant. */
export function vietnamDayStart(now: Date = new Date()): Date {
  const offset = 7 * 3_600_000;
  const day = 86_400_000;
  return new Date(Math.floor((now.getTime() + offset) / day) * day - offset);
}

const pick = (locale: Locale, vi: string | null, en: string | null) =>
  locale === "en" && en ? en : vi;

export function productView(
  product: RewardProduct & { brand: RewardBrand },
  locale: Locale,
) {
  return {
    id: product.id,
    name:
      product.displayNameOverride ??
      pick(locale, product.nameVi, product.nameEn),
    imageUrl: product.imageOverride ?? product.imageUrl,
    category: product.category,
    brand: {
      id: product.brand.id,
      name: pick(locale, product.brand.nameVi, product.brand.nameEn),
      logoUrl: product.brand.logoUrl,
    },
    faceValueVnd: product.faceValueVnd.toString(),
    priceCredit: formatCredit(product.priceCredit),
    priceVersion: product.priceVersion,
    terms: pick(locale, product.termsVi, product.termsEn),
    validityDays: product.validityDays,
    status: product.status,
    sortOrder: product.sortOrder,
  };
}

export function adminProductView(
  product: RewardProduct & { brand: RewardBrand },
) {
  return {
    ...productView(product, "vi"),
    provider: product.provider,
    providerProductId: product.providerProductId,
    syncedAt: product.syncedAt.toISOString(),
  };
}
