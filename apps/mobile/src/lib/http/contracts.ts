import { z } from "zod";
import { AppError } from "@/lib/http/errors";

export const uuid = z.uuid();
export const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const timestamp = z.iso.datetime({ offset: true });
export const sequence = z.string().regex(/^(?:0|[1-9]\d{0,18})$/);
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("protocol");
  return result.data;
}
export function resourcePath(resource: string, id: string) {
  parse(uuid, id);
  return `/${resource}/${encodeURIComponent(id)}`;
}
export function parsePage<T>(
  schema: z.ZodType<T>,
  input: unknown,
  forward = false,
) {
  const result = parse(
    z.object({
      data: z.array(schema),
      meta: z.object({
        pagination: z.object({
          limit: z.number().int().min(1).max(100),
          hasMore: z.boolean(),
          nextCursor: z.string().min(1).nullable(),
        }),
      }),
    }),
    input,
  );
  if (
    forward
      ? result.meta.pagination.nextCursor !== null
      : result.meta.pagination.hasMore !==
        (result.meta.pagination.nextCursor !== null)
  )
    throw new AppError("protocol");
  return { items: result.data, ...result.meta.pagination };
}
export function pageQuery(cursor?: string) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return query;
}
