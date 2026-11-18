import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  beforeTimeId,
  readTimeIdCursor,
} from "../../../../shared/http/time-id-cursor";
import { parseAbsoluteTimestamp } from "../../../../shared/time/timestamp.policy";
import type { Principal } from "../../../auth/application/services/sessions.service";

const querySchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().max(1024).optional(),
  actorId: z.uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  targetType: z.string().trim().min(1).max(100).optional(),
  targetId: z.string().trim().min(1).max(256).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AuditReadQuery = z.input<typeof querySchema>;
export type AuditTargetQuery = Pick<AuditReadQuery, "limit" | "cursor"> & {
  targetType: string;
  targetId: string;
  action: string;
};

const metadataSelect = {
  id: true,
  actorKind: true,
  actorId: true,
  actorRole: true,
  actorRoles: true,
  systemActor: true,
  action: true,
  targetType: true,
  targetId: true,
  reason: true,
  createdAt: true,
  requestId: true,
  correlationId: true,
} as const;

@Injectable()
export class AuditReader {
  constructor(private readonly db: PrismaService) {}

  async list(principal: Principal, query: AuditReadQuery) {
    if (
      !principal.roles.includes("ADMIN") ||
      !principal.permissions.includes("audit:read")
    )
      throw new ForbiddenException("AUDIT_READ_PERMISSION_REQUIRED");
    const { where, limit, scope } = this.prepare(
      query,
      `admin:${principal.userId}`,
    );
    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: metadataSelect,
    });
    // Explicit projection also protects consumers from legacy snapshot/IP/UA fields.
    return this.page(
      rows.map((row) => ({
        id: row.id,
        actorKind: row.actorKind,
        actorId: row.actorId,
        actorRole: row.actorRole,
        actorRoles: row.actorRoles,
        systemActor: row.systemActor,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        reason: row.reason,
        createdAt: row.createdAt,
        requestId: row.requestId,
        correlationId: row.correlationId,
      })),
      limit,
      scope,
    );
  }

  /** Internal owner contract: the calling module must authorize the target first. */
  async readTarget(query: AuditTargetQuery) {
    if (!query.targetType || !query.targetId || !query.action)
      throw new BadRequestException("INVALID_AUDIT_TARGET");
    const { where, limit, scope } = this.prepare(query, "owner-target");
    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: { ...metadataSelect, before: true, after: true },
    });
    return this.page(rows, limit, scope);
  }

  private prepare(input: AuditReadQuery, viewer: string) {
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("INVALID_AUDIT_QUERY");
    const { limit, cursor, actorId, action, targetType, targetId, from, to } =
      parsed.data;
    let start: Date | undefined;
    let end: Date | undefined;
    try {
      start = from === undefined ? undefined : parseAbsoluteTimestamp(from);
      end = to === undefined ? undefined : parseAbsoluteTimestamp(to);
    } catch {
      throw new BadRequestException("INVALID_AUDIT_DATE");
    }
    if (start && end && start >= end)
      throw new BadRequestException("INVALID_AUDIT_RANGE");
    const scope = createHash("sha256")
      .update(
        JSON.stringify([
          "audit-created-id-desc-v1",
          viewer,
          actorId,
          action,
          targetType,
          targetId,
          start?.toISOString(),
          end?.toISOString(),
        ]),
      )
      .digest("hex");
    const boundary = readTimeIdCursor(cursor, scope);
    return {
      limit,
      scope,
      where: {
        ...(actorId ? { actorId } : {}),
        ...(action ? { action } : {}),
        ...(targetType ? { targetType } : {}),
        ...(targetId ? { targetId } : {}),
        ...(start || end
          ? {
              createdAt: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lt: end } : {}),
              },
            }
          : {}),
        ...beforeTimeId("createdAt", boundary),
      },
    };
  }

  private page<T extends { id: string; createdAt: Date }>(
    rows: T[],
    limit: number,
    scope: string,
  ) {
    const data = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = data.at(-1);
    return {
      data,
      pagination: {
        limit,
        hasMore,
        nextCursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({
                  scope,
                  value: last.createdAt.toISOString(),
                  id: last.id,
                }),
              ).toString("base64url")
            : null,
      },
    };
  }
}
