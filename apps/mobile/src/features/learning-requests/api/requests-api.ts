import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import type { HttpClient, RequestOptions } from "@/lib/http/client";
import {
  ownerSchema,
  publicSchema,
  publicDetailSchema,
  skillSchema,
  tagSchema,
  ownOfferingSchema,
  type RequestInput,
  type RequestPatch,
  type RequestFilters,
  type Page,
} from "../types";
const paginationSchema = z.object({
  nextCursor: z.string().min(1).nullable(),
  hasMore: z.boolean(),
  limit: z.number().int().positive(),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("protocol");
  return result.data;
}
export function parsePage<T>(schema: z.ZodType<T>, value: unknown): Page<T> {
  const page = parse(
    z.object({
      data: z.array(schema),
      meta: z.object({ pagination: paginationSchema }),
    }),
    value,
  );
  const { nextCursor, hasMore } = page.meta.pagination;
  if (hasMore !== (nextCursor !== null)) throw new AppError("protocol");
  return { items: page.data, nextCursor, hasMore };
}
export function queryString(
  filters: RequestFilters & { cursor?: string; q?: string },
  limit = 20,
): string {
  const query = new URLSearchParams({ limit: String(limit) });
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) value.forEach((id) => query.append(key, id));
    else if (value) query.set(key, value);
  }
  return query.toString();
}
export function createRequestsApi(client: HttpClient, isCurrent = () => true) {
  async function call(path: string, options: RequestOptions = {}) {
    if (!isCurrent()) throw new AppError("session");
    const result = await client.request(path, {
      ...options,
      authenticated: true,
    });
    if (!isCurrent()) throw new AppError("session");
    return result;
  }
  const path = (id: string) => {
    if (!z.uuid().safeParse(id).success) throw new AppError("protocol");
    return `/learning-requests/${encodeURIComponent(id)}`;
  };
  return {
    async list(
      scope: "mine" | "feed" | "recommended",
      filters: RequestFilters = {},
      cursor?: string,
    ) {
      const suffix = scope === "feed" ? "" : `/${scope}`;
      const result = await call(
        `/learning-requests${suffix}?${queryString({ ...filters, cursor })}`,
        { includeMeta: true },
      );
      return scope === "mine"
        ? parsePage(ownerSchema, result)
        : parsePage(publicSchema, result);
    },
    async detail(id: string) {
      const result = parse(
        z.union([ownerSchema, publicDetailSchema]),
        await call(path(id)),
      );
      if (result.id !== id) throw new AppError("protocol");
      return result;
    },
    async create(body: RequestInput) {
      return parse(
        ownerSchema,
        await call("/learning-requests", { method: "POST", body }),
      );
    },
    async edit(id: string, body: RequestPatch) {
      const result = parse(
        ownerSchema,
        await call(path(id), { method: "PATCH", body }),
      );
      if (result.id !== id) throw new AppError("protocol");
      return result;
    },
    async action(
      id: string,
      action: "publish" | "cancel",
      expectedVersion: number,
    ) {
      const result = parse(
        ownerSchema,
        await call(`${path(id)}/${action}`, {
          method: "POST",
          body: { expectedVersion },
        }),
      );
      if (result.id !== id) throw new AppError("protocol");
      return result;
    },
    async skills(cursor?: string, q?: string) {
      return parsePage(
        skillSchema,
        await call(`/skills?${queryString({ cursor, q })}`, {
          includeMeta: true,
        }),
      );
    },
    async tags(cursor?: string, q?: string) {
      return parsePage(
        tagSchema,
        await call(`/tags?${queryString({ cursor, q })}`, {
          includeMeta: true,
        }),
      );
    },
    async offerings(cursor?: string) {
      return parsePage(
        ownOfferingSchema,
        await call(`/me/skills?${queryString({ cursor })}`, {
          includeMeta: true,
        }),
      );
    },
    async skill(id: string) {
      if (!z.uuid().safeParse(id).success) throw new AppError("protocol");
      const result = parse(
        skillSchema,
        await call(`/skills/${encodeURIComponent(id)}`),
      );
      if (result.id !== id) throw new AppError("protocol");
      return result;
    },
  };
}
