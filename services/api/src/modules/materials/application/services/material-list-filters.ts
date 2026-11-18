import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";
import type { MaterialAccess } from "../../domain/material.policy";
import { parseAbsoluteTimestamp } from "../../../../shared/time/timestamp.policy";

export type MaterialListFilters = {
  q?: string;
  ownerId?: string;
  skillId?: string;
  accessType?: MaterialAccess;
  from?: string;
  to?: string;
};

/** Material creation time, inclusive from and exclusive to, across list surfaces. */
export function materialListWhere(
  query: MaterialListFilters,
): Prisma.MaterialWhereInput {
  const from = parseInstant(query.from);
  const to = parseInstant(query.to);
  if (from && to && from >= to)
    throw new BadRequestException("INVALID_MATERIAL_TIME_RANGE");
  const q = query.q?.trim();
  return {
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.skillId ? { skillId: query.skillId } : {}),
    ...(query.accessType ? { accessType: query.accessType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/** Retain existing unfiltered cursors; filtered cursors bind the entire search. */
export function materialFilterScope(query: MaterialListFilters): unknown[] {
  const filters = [
    query.q?.trim().toLowerCase() || null,
    query.ownerId ?? null,
    query.skillId ?? null,
    query.accessType ?? null,
    query.from ? parseInstant(query.from)?.toISOString() : null,
    query.to ? parseInstant(query.to)?.toISOString() : null,
  ];
  return filters.some((value) => value !== null) ? filters : [];
}

export function materialListSql(query: MaterialListFilters) {
  // Validate with the same contract as Prisma-backed lists before constructing SQL.
  materialListWhere(query);
  const q = query.q?.trim();
  const pattern = q ? `%${q}%` : null;
  return Prisma.sql`
    ${query.ownerId ? Prisma.sql`AND material.owner_id = ${query.ownerId}::uuid` : Prisma.empty}
    ${query.skillId ? Prisma.sql`AND material.skill_id = ${query.skillId}::uuid` : Prisma.empty}
    ${query.accessType ? Prisma.sql`AND material.access_type = ${query.accessType}` : Prisma.empty}
    ${query.from ? Prisma.sql`AND material.created_at >= ${parseInstant(query.from)}` : Prisma.empty}
    ${query.to ? Prisma.sql`AND material.created_at < ${parseInstant(query.to)}` : Prisma.empty}
    ${pattern ? Prisma.sql`AND (material.title ILIKE ${pattern} OR material.description ILIKE ${pattern})` : Prisma.empty}`;
}

function parseInstant(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  try {
    return parseAbsoluteTimestamp(value);
  } catch {
    throw new BadRequestException("INVALID_MATERIAL_TIME_RANGE");
  }
}
