import type { RequestOptions } from "@/lib/http/client";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  uuid,
  version,
} from "@/lib/http/contracts";
import { readCursorPages } from "@/lib/http/cursor-pages";
import { AppError } from "@/lib/http/errors";
import { orderSchema } from "./material-contracts";

export function createMaterialOrdersApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const post = (path: string, body?: unknown, idempotencyKey?: string) =>
    call(path, {
      method: "POST",
      body,
      idempotencyKey,
      replayAfterRenewal: false,
    });
  return {
    async ordersPage(cursor?: string, signal?: AbortSignal) {
      const page = parsePage(
        orderSchema,
        await call(`/me/material-orders?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
      if (new Set(page.items.map((row) => row.id)).size !== page.items.length)
        throw new AppError("protocol");
      return page;
    },
    async ownedOrder(materialId: string, signal?: AbortSignal) {
      parse(uuid, materialId);
      const matches = (row: { materialId: string; status: string }) =>
        row.materialId === materialId && row.status === "SUCCESS";
      const rows = await readCursorPages(
        call,
        "/me/material-orders",
        orderSchema,
        signal,
        (items) => items.some(matches),
      );
      return rows.find(matches) ?? null;
    },
    async purchase(id: string, expectedListingVersion: number, key: string) {
      parse(version, expectedListingVersion);
      if (!/^[\x21-\x7e]{1,200}$/.test(key)) throw new AppError("protocol");
      const row = parse(
        orderSchema,
        await post(
          resourcePath("materials", id) + "/purchase",
          { expectedListingVersion },
          key,
        ),
      );
      if (row.materialId !== id) throw new AppError("protocol");
      return row;
    },
    async refund(id: string) {
      const row = parse(
        orderSchema,
        await post(resourcePath("me/material-orders", id) + "/refund"),
      );
      if (row.id !== id || row.status !== "REFUNDED")
        throw new AppError("protocol");
      return row;
    },
  };
}
