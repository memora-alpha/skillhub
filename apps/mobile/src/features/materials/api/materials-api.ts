import { z } from "zod";
import { readCursorPages } from "@/lib/http/cursor-pages";
import type { RequestOptions } from "@/lib/http/client";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  uuid,
} from "@/lib/http/contracts";
import { uploadedFileSchema } from "@/lib/http/file-upload";
import { AppError } from "@/lib/http/errors";
import {
  materialSchema,
  materialInput,
  orderSchema,
  downloadSchema,
  type MaterialInput,
} from "./material-contracts";
export function createMaterialsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  const root = (id: string) => resourcePath("me/materials", id);
  const post = (path: string, body?: unknown, idempotencyKey?: string) =>
    call(path, {
      method: "POST",
      body,
      idempotencyKey,
      replayAfterRenewal: false,
    });
  async function mine(signal?: AbortSignal) {
    const rows = await readCursorPages(
      call,
      "/me/materials",
      materialSchema,
      signal,
    );
    if (rows.some((row) => row.ownerId !== userId))
      throw new AppError("protocol");
    return rows;
  }
  return {
    mine,
    async minePage(cursor?: string, signal?: AbortSignal) {
      return parsePage(
        materialSchema,
        await call(`/me/materials?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
    },
    async ordersPage(cursor?: string, signal?: AbortSignal) {
      return parsePage(
        orderSchema,
        await call(`/me/material-orders?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
    },
    async search(
      q = "",
      accessType?: "FREE" | "PAID",
      page = 1,
      signal?: AbortSignal,
    ) {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(q ? { q } : {}),
        ...(accessType ? { accessType } : {}),
      });
      const result = parse(
        z.object({
          data: z.array(materialSchema),
          meta: z.object({
            pagination: z.object({
              page: z.number().int().min(1),
              limit: z.number().int().min(1).max(50),
              total: z.number().int().nonnegative(),
            }),
          }),
        }),
        await call("/materials?" + query, { includeMeta: true, signal }),
      );
      if (result.data.some((row) => row.status !== "PUBLISHED"))
        throw new AppError("protocol");
      return {
        items: result.data,
        nextPage:
          result.meta.pagination.page * result.meta.pagination.limit <
          result.meta.pagination.total
            ? page + 1
            : undefined,
      };
    },
    async detail(id: string, signal?: AbortSignal) {
      let value: unknown;
      try {
        value = await call(resourcePath("materials", id), { signal });
      } catch (cause) {
        if (!(cause instanceof AppError) || cause.status !== 404) throw cause;
        value = (await mine(signal)).find((row) => row.id === id);
        if (!value) throw cause;
      }
      const row = parse(materialSchema, value);
      if (row.id !== id) throw new AppError("protocol");
      return row;
    },
    async create(body: MaterialInput) {
      const row = parse(
        materialSchema,
        await post("/me/materials", parse(materialInput, body)),
      );
      if (row.ownerId !== userId) throw new AppError("protocol");
      return row;
    },
    async update(
      id: string,
      expectedListingVersion: number,
      body: MaterialInput,
    ) {
      const row = parse(
        materialSchema,
        await call(root(id), {
          method: "PATCH",
          body: { ...parse(materialInput, body), expectedListingVersion },
          replayAfterRenewal: false,
        }),
      );
      if (row.id !== id || row.ownerId !== userId)
        throw new AppError("protocol");
      return row;
    },
    async submit(id: string) {
      return parse(materialSchema, await post(root(id) + "/submit"));
    },
    async archive(id: string) {
      return parse(materialSchema, await post(root(id) + "/archive"));
    },
    async upload(body: FormData) {
      return parse(
        uploadedFileSchema,
        await call("/me/materials/files", {
          method: "POST",
          body,
          multipart: true,
          replayAfterRenewal: false,
        }),
      );
    },
    async fileStatus(id: string) {
      const row = parse(
        uploadedFileSchema,
        await call(resourcePath("me/materials/files", id)),
      );
      if (row.fileId !== id) throw new AppError("protocol");
      return row;
    },
    async skills(q: string, cursor?: string, signal?: AbortSignal) {
      const query = pageQuery(cursor);
      if (q) query.set("q", q);
      return parsePage(
        z.object({ id: uuid, name: z.string() }),
        await call("/skills?" + query, { includeMeta: true, signal }),
      );
    },
    async orders(signal?: AbortSignal) {
      return readCursorPages(call, "/me/material-orders", orderSchema, signal);
    },
    async ownedOrder(materialId: string, signal?: AbortSignal) {
      parse(uuid, materialId);
      const matches = (row: z.infer<typeof orderSchema>) =>
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
    async download(id: string) {
      const result = parse(
        downloadSchema,
        await call(resourcePath("materials", id) + "/download"),
      );
      if (Date.parse(result.expiresAt) <= Date.now())
        throw new AppError("protocol");
      return result;
    },
  };
}
