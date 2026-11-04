import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const schema = z.strictObject({
  scope: z.string(),
  value: z.iso.datetime({ precision: 3 }),
  id: z.uuid(),
});

/** Cursor for descending timestamp/UUID lists; the value survives row updates. */
export function readTimeIdCursor(value: string | undefined, scope: string) {
  if (!value) return;
  try {
    if (value.length > 1024) throw new Error("Cursor exceeds maximum length");
    const cursor = schema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    const at = new Date(cursor.value);
    if (
      cursor.scope !== scope ||
      !Number.isFinite(at.getTime()) ||
      at.getUTCFullYear() < 1 ||
      at.toISOString() !== cursor.value
    )
      throw new Error("Cursor has invalid scope or timestamp");
    return { id: cursor.id, at };
  } catch {
    throw new BadRequestException("INVALID_CURSOR");
  }
}

/** AND keeps the timestamp boundary separate from the caller's membership OR. */
export function beforeTimeId(
  field: "createdAt" | "lastActivityAt",
  cursor: ReturnType<typeof readTimeIdCursor>,
) {
  if (!cursor) return {};
  return {
    AND: [
      {
        OR: [
          { [field]: { lt: cursor.at } },
          { [field]: cursor.at, id: { lt: cursor.id } },
        ],
      },
    ],
  };
}
