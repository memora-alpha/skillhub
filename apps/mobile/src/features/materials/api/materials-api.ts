import { createMaterialCatalogApi } from "./material-catalog-api";
import { createMaterialOrdersApi } from "./material-orders-api";
import { createMaterialReviewsApi } from "./material-reviews-api";
import { createMaterialFavoritesApi } from "./material-favorites-api";
import { createMaterialLibraryApi } from "./material-library-api";
import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  uuid,
  version,
} from "@/lib/http/contracts";
import { uploadedFileSchema } from "@/lib/http/file-upload";
import { AppError } from "@/lib/http/errors";
import {
  materialSchema,
  materialInput,
  type MaterialInput,
  type ApiMaterial,
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
  async function ownerDetail(id: string, signal?: AbortSignal) {
    const row = parse(materialSchema, await call(root(id), { signal }));
    if (row.id !== id || row.ownerId !== userId) throw new AppError("protocol");
    return row;
  }
  return {
    ownerDetail,
    async minePage(
      cursor?: string,
      signal?: AbortSignal,
      status?: ApiMaterial["status"],
    ) {
      const page = parsePage(
        materialSchema,
        await call(
          `/me/materials?${pageQuery(cursor)}${status ? `&status=${status}` : ""}`,
          {
            includeMeta: true,
            signal,
          },
        ),
      );
      if (
        page.items.some(
          (row) => row.ownerId !== userId || (status && row.status !== status),
        )
      )
        throw new AppError("protocol");
      return page;
    },
    async create(body: MaterialInput) {
      if (body.coverFileId === null) throw new AppError("protocol");
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
      const row = parse(materialSchema, await post(root(id) + "/submit"));
      if (
        row.id !== id ||
        row.ownerId !== userId ||
        row.status !== "PENDING_REVIEW"
      )
        throw new AppError("protocol");
      return row;
    },
    async archive(id: string) {
      const row = parse(materialSchema, await post(root(id) + "/archive"));
      if (row.id !== id || row.ownerId !== userId || row.status !== "ARCHIVED")
        throw new AppError("protocol");
      return row;
    },
    async withdraw(id: string, expectedListingVersion: number) {
      parse(version, expectedListingVersion);
      const row = parse(
        materialSchema,
        await post(root(id) + "/withdraw", { expectedListingVersion }),
      );
      if (row.id !== id || row.ownerId !== userId || row.status !== "DRAFT")
        throw new AppError("protocol");
      return row;
    },
    async remove(id: string, expectedListingVersion: number) {
      parse(version, expectedListingVersion);
      const receipt = parse(
        z.object({
          id: uuid,
          deleted: z.literal(true),
          replayed: z.boolean(),
        }),
        await call(
          `${root(id)}?expectedListingVersion=${expectedListingVersion}`,
          {
            method: "DELETE",
            replayAfterRenewal: false,
          },
        ),
      );
      if (receipt.id !== id) throw new AppError("protocol");
      return receipt;
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
    async uploadCover(body: FormData) {
      return parse(
        uploadedFileSchema,
        await call("/me/materials/cover-files", {
          method: "POST",
          body,
          multipart: true,
          replayAfterRenewal: false,
        }),
      );
    },
    async fileStatus(id: string, signal?: AbortSignal) {
      const row = parse(
        uploadedFileSchema,
        await call(resourcePath("me/materials/files", id), { signal }),
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
    ...createMaterialOrdersApi(call),
    ...createMaterialReviewsApi(call),
    ...createMaterialFavoritesApi(call),
    ...createMaterialLibraryApi(call),
    ...createMaterialCatalogApi(call, ownerDetail),
  };
}
