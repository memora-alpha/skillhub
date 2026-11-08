import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Principal } from "../../modules/auth/application/services/sessions.service";

export function requireFinanceAdmin(actor: Principal, permission: string) {
  if (!actor.roles.includes("ADMIN") || !actor.permissions.includes(permission))
    throw new ForbiddenException("ADMIN_FINANCE_PERMISSION_REQUIRED");
}
export function financeScope(actorId: string, kind: string, filter: object) {
  const sorted = Object.fromEntries(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify({ actorId, kind, filter: sorted });
}
const boundarySchema = z.strictObject({
  scope: z.string(),
  date: z.iso.datetime(),
  id: z.uuid(),
});
export function financeCursor(secret: string, scope: string) {
  const sign = (body: string) =>
    createHmac("sha256", secret).update(body).digest();
  return {
    decode(value?: string) {
      if (!value) return null;
      try {
        if (value.length > 2048) throw new Error("size");
        const [body, tag, extra] = value.split(".");
        const expected = sign(body!),
          supplied = Buffer.from(tag!, "base64url");
        if (
          extra ||
          expected.length !== supplied.length ||
          !timingSafeEqual(expected, supplied)
        )
          throw new Error("signature");
        const row = boundarySchema.parse(
          JSON.parse(Buffer.from(body!, "base64url").toString("utf8")),
        );
        if (row.scope !== scope) throw new Error("scope");
        return { createdAt: new Date(row.date), id: row.id };
      } catch {
        throw new BadRequestException("INVALID_ADMIN_FINANCE_CURSOR");
      }
    },
    encode(row: { id: string; createdAt: Date }) {
      const body = Buffer.from(
        JSON.stringify({
          scope,
          date: row.createdAt.toISOString(),
          id: row.id,
        }),
      ).toString("base64url");
      return body + "." + sign(body).toString("base64url");
    },
  };
}
export function adminTimeRange(from?: string, to?: string) {
  if (
    (from && !z.iso.datetime().safeParse(from).success) ||
    (to && !z.iso.datetime().safeParse(to).success)
  )
    throw new BadRequestException("INVALID_ADMIN_FINANCE_DATE");
  if (from && to && new Date(from) > new Date(to))
    throw new BadRequestException("INVALID_ADMIN_FINANCE_RANGE");
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}
export function adminBefore(row: { id: string; createdAt: Date } | null) {
  return row
    ? {
        OR: [
          { createdAt: { lt: row.createdAt } },
          { createdAt: row.createdAt, id: { lt: row.id } },
        ],
      }
    : {};
}
