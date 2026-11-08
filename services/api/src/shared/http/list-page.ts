import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListPageQuery {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;
}
const cursorSchema = z.strictObject({
  scope: z.string(),
  value: z.iso.datetime({ precision: 3 }),
  id: z.uuid(),
  anchor: z.iso.datetime({ precision: 3 }).optional(),
});
export function listInput(
  query: { limit?: number; cursor?: string },
  scope: string,
) {
  const limit = query.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new BadRequestException("INVALID_PAGE_LIMIT");
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (query.cursor) {
    try {
      if (query.cursor.length > 2048) throw new Error("Oversized cursor");
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")),
      );
      if (cursor.scope !== scope) throw new Error("Cursor scope mismatch");
    } catch {
      throw new BadRequestException("INVALID_CURSOR");
    }
  }
  return { limit, cursor };
}
export function listBoundary(
  field: "createdAt" | "updatedAt" | "startAt",
  cursor: ReturnType<typeof listInput>["cursor"],
  ascending = false,
) {
  if (!cursor) return {};
  const op = ascending ? "gt" : "lt";
  const at = new Date(cursor.value);
  return {
    AND: [
      {
        OR: [
          { [field]: { [op]: at } },
          { [field]: at, id: { [op]: cursor.id } },
        ],
      },
    ],
  };
}
export function listResult<T extends { id: string }>(
  rows: T[],
  limit: number,
  scope: string,
  time: (row: T) => Date,
  anchor?: Date,
) {
  const data = rows.slice(0, limit),
    last = data.at(-1),
    hasMore = rows.length > limit;
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
                value: time(last).toISOString(),
                id: last.id,
                ...(anchor ? { anchor: anchor.toISOString() } : {}),
              }),
            ).toString("base64url")
          : null,
    },
  };
}
