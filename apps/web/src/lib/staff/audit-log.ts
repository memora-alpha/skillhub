import { StaffApiError } from "./client";

export const emptyAuditFilters = {
  actorId: "",
  action: "",
  targetType: "",
  targetId: "",
  from: "",
  to: "",
};
export type AuditFilters = typeof emptyAuditFilters;
export type AuditLog = {
  id: string;
  actorKind: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorRoles: string[];
  systemActor: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
  requestId: string | null;
  correlationId: string | null;
};
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function auditQuery(filters: AuditFilters) {
  const params = new URLSearchParams({ limit: "20" });
  for (const key of ["actorId", "action", "targetType", "targetId"] as const) {
    const value = filters[key].trim();
    if (key === "actorId" && value && !uuid.test(value))
      throw new Error("Mã người thực hiện chưa hợp lệ.");
    const max = key === "targetId" ? 256 : 100;
    if (value.length > max) throw new Error(`Bộ lọc vượt quá ${max} ký tự.`);
    if (value) params.set(key, value);
  }
  for (const key of ["from", "to"] as const) {
    if (!filters[key]) continue;
    const value = new Date(filters[key]);
    if (!Number.isFinite(+value)) throw new Error("Thời gian lọc chưa hợp lệ.");
    params.set(key, value.toISOString());
  }
  if (
    params.has("from") &&
    params.has("to") &&
    params.get("from")! >= params.get("to")!
  )
    throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc.");
  return params;
}

function invalid(): never {
  throw new StaffApiError(502, "API_RESPONSE_INVALID");
}
function string(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}
function nullable(value: unknown) {
  return value === null ? null : string(value);
}
export function readAuditLogs(input: unknown): AuditLog[] {
  if (!Array.isArray(input) || input.length > 100) return invalid();
  const ids = new Set<string>();
  return input.map((value): AuditLog => {
    if (!value || typeof value !== "object") return invalid();
    const row = value as Record<string, unknown>;
    const id = string(row.id),
      actorId = nullable(row.actorId),
      createdAt = string(row.createdAt);
    if (
      !uuid.test(id) ||
      ids.has(id) ||
      (actorId !== null && !uuid.test(actorId)) ||
      !Number.isFinite(Date.parse(createdAt))
    )
      return invalid();
    if (
      !Array.isArray(row.actorRoles) ||
      row.actorRoles.some((role) => typeof role !== "string")
    )
      return invalid();
    ids.add(id);
    return {
      id,
      actorId,
      createdAt,
      actorKind: nullable(row.actorKind),
      actorRole: nullable(row.actorRole),
      actorRoles: row.actorRoles as string[],
      systemActor: nullable(row.systemActor),
      action: string(row.action),
      targetType: string(row.targetType),
      targetId: string(row.targetId),
      reason: nullable(row.reason),
      requestId: nullable(row.requestId),
      correlationId: nullable(row.correlationId),
    };
  });
}
