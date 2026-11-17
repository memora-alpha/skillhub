import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { parse, resourcePath, uuid } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import {
  materialSchema,
  downloadSchema,
  type ApiMaterial,
} from "./material-contracts";

export function createMaterialCatalogApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  ownerDetail: (id: string, signal?: AbortSignal) => Promise<ApiMaterial>,
) {
  const published = (value: unknown, id?: string) => {
    const row = parse(materialSchema, value);
    if (row.status !== "PUBLISHED" || (id && row.id !== id))
      throw new AppError("protocol");
    return row;
  };
  const catalog = {
    async search(
      q = "",
      accessType?: "FREE" | "PAID",
      page = 1,
      signal?: AbortSignal,
      skillId?: string,
    ) {
      if (skillId) parse(uuid, skillId);
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 10_000 ||
        q.length > 100
      )
        throw new AppError("protocol");
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(q ? { q } : {}),
        ...(accessType ? { accessType } : {}),
        ...(skillId ? { skillId } : {}),
      });
      const result = parse(
        z.object({
          data: z.array(materialSchema),
          meta: z.object({
            pagination: z.object({
              page: z.number().int().positive(),
              limit: z.number().int().min(1).max(50),
              total: z.number().int().nonnegative(),
            }),
          }),
        }),
        await call(`/materials?${query}`, { includeMeta: true, signal }),
      );
      const pagination = result.meta.pagination;
      if (
        pagination.page !== page ||
        result.data.length > pagination.limit ||
        new Set(result.data.map((row) => row.id)).size !== result.data.length
      )
        throw new AppError("protocol");
      result.data.forEach((row) => published(row));
      return {
        items: result.data,
        total: pagination.total,
        nextPage:
          page * pagination.limit < pagination.total ? page + 1 : undefined,
      };
    },
    async related(
      id: string,
      skillId: string,
      signal?: AbortSignal,
    ): Promise<ApiMaterial[]> {
      parse(uuid, id);
      const page = await catalog.search("", undefined, 1, signal, skillId);
      return page.items
        .filter((row) => row.id !== id && row.skillId === skillId)
        .slice(0, 4);
    },
    async publicDetail(id: string, signal?: AbortSignal) {
      return published(
        await call(resourcePath("materials", id), { signal }),
        id,
      );
    },
    async detail(id: string, signal?: AbortSignal) {
      try {
        return published(
          await call(resourcePath("materials", id), { signal }),
          id,
        );
      } catch (cause) {
        if (!(cause instanceof AppError) || cause.status !== 404) throw cause;
        return ownerDetail(id, signal);
      }
    },
    async download(id: string, signal?: AbortSignal) {
      // Issuing the URL consumes purchased access on BE. Never prefetch or replay.
      const file = parse(
        downloadSchema,
        await call(resourcePath("materials", id) + "/download", {
          replayAfterRenewal: false,
          signal,
        }),
      );
      if (Date.parse(file.expiresAt) <= Date.now())
        throw new AppError("protocol");
      return file;
    },
  };
  return catalog;
}
