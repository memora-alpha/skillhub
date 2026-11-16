import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { parsePage, pageQuery, timestamp } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import { materialSchema } from "./material-contracts";

export const freeMaterialAccess = z
  .object({
    accessSource: z.literal("FREE_PUBLIC"),
    firstAccessedAt: timestamp,
    lastAccessedAt: timestamp,
    material: materialSchema,
  })
  .refine(
    (row) =>
      row.material.status === "PUBLISHED" &&
      row.material.accessType === "FREE" &&
      Date.parse(row.firstAccessedAt) <= Date.parse(row.lastAccessedAt),
  );
export type FreeMaterialAccess = z.infer<typeof freeMaterialAccess>;

export function createMaterialLibraryApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async freeLibraryPage(cursor?: string, signal?: AbortSignal) {
      const page = parsePage(
        freeMaterialAccess,
        await call(`/me/material-library/free?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }).catch((error: unknown) => {
          // Older deployments have no route and return an untyped "Cannot GET" 404.
          // Keep permission and material-specific errors intact.
          if (error instanceof AppError && error.status === 404 && !error.code)
            throw new AppError(
              "http",
              404,
              "MATERIAL_FREE_LIBRARY_UNAVAILABLE",
            );
          throw error;
        }),
      );
      if (
        new Set(page.items.map((row) => row.material.id)).size !==
        page.items.length
      )
        throw new AppError("protocol");
      return {
        ...page,
        items: page.items.map((row) => ({ ...row, id: row.material.id })),
      };
    },
  };
}
