import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const cursorSchema = z.strictObject({
  scope: z.string(),
  at: z.iso.datetime({ precision: 3 }),
  key: z
    .string()
    .regex(
      /^(?:request|conversation):[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/,
    ),
});

export function readInboxGroupCursor(value: string | undefined, scope: string) {
  if (!value) return;
  try {
    if (value.length > 1024) throw new Error("Cursor exceeds maximum length");
    const cursor = cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    if (cursor.scope !== scope)
      throw new Error("Cursor belongs to another viewer or ordering");
    const at = new Date(cursor.at);
    if (
      !Number.isFinite(at.getTime()) ||
      at.getUTCFullYear() < 1 ||
      at.toISOString() !== cursor.at
    )
      throw new Error(
        "Cursor timestamp is outside the supported database range",
      );
    return { key: cursor.key, at };
  } catch {
    throw new BadRequestException("INVALID_CURSOR");
  }
}

export function writeInboxGroupCursor(scope: string, key: string, at: Date) {
  return Buffer.from(
    JSON.stringify({ scope, key, at: at.toISOString() }),
  ).toString("base64url");
}
