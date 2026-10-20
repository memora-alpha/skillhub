import { BadRequestException, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";

export const SKILL_PERMISSIONS = {
  USER: [
    "sharing-skill:create:self",
    "sharing-skill:update:self",
    "sharing-skill:archive:self",
    "sharing-skill:restore:self",
    "skill-verification:submit:self",
  ],
  STAFF: [
    "sharing-skill:create:self",
    "sharing-skill:update:self",
    "sharing-skill:archive:self",
    "sharing-skill:restore:self",
    "skill-verification:submit:self",
    "skill-verification:read",
    "skill-verification:approve",
    "skill-verification:reject",
  ],
  ADMIN: [
    "skill-level:manage",
    "sharing-skill:create:self",
    "sharing-skill:update:self",
    "sharing-skill:archive:self",
    "sharing-skill:restore:self",
    "skill-verification:submit:self",
    "skill-verification:read",
    "skill-verification:approve",
    "skill-verification:reject",
    "skill-verification:revoke",
    "skill-catalog:create",
    "skill-catalog:update",
    "skill-catalog:archive",
    "skill-catalog:restore",
  ],
} as const;
export function text(value: string, min: number, max: number): string {
  const result = value.trim().normalize("NFC");
  if ([...result].length < min || [...result].length > max)
    throw new BadRequestException("INVALID_TEXT_LENGTH");
  return result;
}
export function nameKey(value: string): string {
  return text(value, 2, 100).replace(/\s+/gu, " ").toLowerCase();
}
export function skillSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("đ", "d")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])$/u.test(slug))
    throw new BadRequestException("INVALID_SKILL_SLUG");
  return slug;
}
export function expectedVersion(actual: number, expected: number): void {
  if (actual !== expected) throw new ConflictException("STALE_VERSION");
}
export function verificationBadge(
  approved: number,
  pending: number,
  submitted: number,
) {
  if (approved > 0) return "VERIFIED" as const;
  if (pending > 0) return "PENDING" as const;
  return submitted > 0 ? ("REJECTED" as const) : ("UNVERIFIED" as const);
}
type Cursor = { scope: string; value: string; id: string };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export function cursorScope(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function readCursor(
  value: string | undefined,
  scope: string,
): Cursor | undefined {
  if (!value) return;
  try {
    if (value.length > 1024) throw new Error("Cursor exceeds maximum length");
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("scope" in parsed) ||
      parsed.scope !== scope ||
      !("id" in parsed) ||
      typeof parsed.id !== "string" ||
      !uuid.test(parsed.id) ||
      !("value" in parsed) ||
      typeof parsed.value !== "string"
    )
      throw new Error("Cursor has invalid fields or scope");
    return parsed as Cursor;
  } catch {
    throw new BadRequestException("INVALID_CURSOR");
  }
}
export function page<T extends { id: string }>(
  rows: T[],
  limit: number,
  scope: string,
  value: (row: T) => string,
) {
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return {
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ scope, value: value(last), id: last.id }),
            ).toString("base64url")
          : null,
    },
  };
}
