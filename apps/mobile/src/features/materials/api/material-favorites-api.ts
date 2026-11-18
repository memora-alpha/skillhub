import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  timestamp,
  uuid,
} from "@/lib/http/contracts";
import { readCursorPages } from "@/lib/http/cursor-pages";
import { AppError } from "@/lib/http/errors";
import { materialSchema } from "./material-contracts";

const favoriteSchema = z.object({
  id: uuid,
  savedAt: timestamp,
  material: materialSchema,
});
export function createMaterialFavoritesApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async favoritesPage(cursor?: string, signal?: AbortSignal) {
      const page = parsePage(
        favoriteSchema,
        await call(`/me/material-favorites?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
      if (
        new Set(page.items.map((row) => row.material.id)).size !==
          page.items.length ||
        page.items.some((row) => row.material.status !== "PUBLISHED")
      )
        throw new AppError("protocol");
      return page;
    },
    async isFavorite(materialId: string, signal?: AbortSignal) {
      parse(uuid, materialId);
      const rows = await readCursorPages(
        call,
        "/me/material-favorites",
        favoriteSchema,
        signal,
        (page) => page.some((row) => row.material.id === materialId),
      );
      return rows.some((row) => row.material.id === materialId);
    },
    async setFavorite(materialId: string, saved: boolean) {
      const result = await call(
        resourcePath("materials", materialId) + "/favorite",
        { method: saved ? "POST" : "DELETE", replayAfterRenewal: false },
      );
      const row = saved
        ? parse(
            z.object({ id: uuid, materialId: uuid, savedAt: timestamp }),
            result,
          )
        : parse(z.object({ materialId: uuid, removed: z.boolean() }), result);
      if (row.materialId !== materialId) throw new AppError("protocol");
      return saved;
    },
  };
}
