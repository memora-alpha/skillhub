import { BadRequestException } from "@nestjs/common";

export type WorkCursor = {
  scope: string;
  receivedAt: Date;
  kind: string;
  id: string;
};

export function decodeWorkCursor(value: string | undefined, scope: string) {
  if (!value) return undefined;
  try {
    if (value.length > 2048) throw new Error("CURSOR_TOO_LONG");
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const receivedAt = new Date(String(parsed.receivedAt));
    if (
      parsed.scope !== scope ||
      typeof parsed.kind !== "string" ||
      typeof parsed.id !== "string" ||
      !Number.isFinite(receivedAt.getTime())
    )
      throw new Error("CURSOR_INVALID");
    return { scope, receivedAt, kind: parsed.kind, id: parsed.id };
  } catch {
    throw new BadRequestException("INVALID_ADMIN_WORK_CURSOR");
  }
}

export function encodeWorkCursor(cursor: WorkCursor) {
  return Buffer.from(
    JSON.stringify({
      scope: cursor.scope,
      receivedAt: cursor.receivedAt.toISOString(),
      kind: cursor.kind,
      id: cursor.id,
    }),
  ).toString("base64url");
}

export function compareWorkKey(
  left: Pick<WorkCursor, "receivedAt" | "kind" | "id">,
  right: Pick<WorkCursor, "receivedAt" | "kind" | "id">,
  newest: boolean,
) {
  const time = left.receivedAt.getTime() - right.receivedAt.getTime();
  if (time !== 0) return newest ? -time : time;
  const kind = left.kind.localeCompare(right.kind);
  if (kind !== 0) return kind;
  return left.id.localeCompare(right.id);
}
