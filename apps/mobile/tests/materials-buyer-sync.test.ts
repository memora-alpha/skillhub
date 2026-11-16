import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import {
  materialSchema,
  orderSchema,
} from "../src/features/materials/api/material-contracts";
import { materialThumbnailUrl } from "../src/features/materials/utils/material-thumbnail";
import {
  fixtureMaterial,
  materialOwnerId,
  materialOtherId,
} from "./fixtures/materials-data";
import { AppError } from "../src/lib/http/errors";

const at = "2026-11-16T03:00:00Z";
const material = fixtureMaterial({ status: "PUBLISHED" });
const page = (data: unknown[], nextCursor: string | null = null) => ({
  data,
  meta: { pagination: { limit: 20, hasMore: !!nextCursor, nextCursor } },
});
const protocol = (error: unknown) =>
  error instanceof AppError && error.kind === "protocol";
const order = {
  id: materialOtherId,
  materialId: material.id,
  sellerId: materialOwnerId,
  listingVersion: 1,
  grossCredit: "10.00",
  feeAmount: "1.00",
  sellerNetCredit: "9.00",
  status: "SUCCESS",
  createdAt: at,
  purchasedMaterial: {
    title: "Tên lúc mua",
    originalFilename: "ban-cu.pdf",
    mimeType: "application/pdf",
    sizeBytes: "1000",
  },
  review: {
    hasReview: false,
    reviewId: null,
    status: null,
    version: null,
    sourceOrderId: null,
    canReview: true,
    reasonCode: null,
  },
  refundEligibility: {
    canRefund: true,
    deadline: "2026-11-17T03:00:00Z",
    evaluatedAt: at,
    reasonCode: null,
  },
};

test("order pages preserve purchased snapshots, review state and server refund decision; receipts can omit enrichments", async () => {
  const api = createMaterialsApi(async () => page([order]), materialOwnerId);
  const row = (await api.ordersPage()).items[0]!;
  assert.deepEqual(row.purchasedMaterial, order.purchasedMaterial);
  assert.deepEqual(row.review, order.review);
  assert.deepEqual(row.refundEligibility, order.refundEligibility);
  const receipt = Object.fromEntries(
    Object.entries(order).filter(
      ([key]) =>
        !["purchasedMaterial", "review", "refundEligibility"].includes(key),
    ),
  );
  assert.equal(orderSchema.safeParse(receipt).success, true);
  for (const value of [
    { ...order, review: { ...order.review, hasReview: true } },
    {
      ...order,
      refundEligibility: {
        ...order.refundEligibility,
        reasonCode: "MATERIAL_ALREADY_CONSUMED",
      },
    },
    {
      ...order,
      purchasedMaterial: { ...order.purchasedMaterial, sizeBytes: "invalid" },
    },
  ])
    assert.equal(orderSchema.safeParse(value).success, false);
  const legacy = {
    ...order,
    purchasedMaterial: {
      title: null,
      originalFilename: null,
      mimeType: null,
      sizeBytes: null,
    },
  };
  assert.equal(orderSchema.safeParse(legacy).success, true);
});

test("favorites use the server cursor and check all pages before deciding an item is not saved", async () => {
  const signal = new AbortController().signal;
  const paths: string[] = [];
  const item = { id: materialOtherId, savedAt: at, material };
  const api = createMaterialsApi(async (path, options) => {
    assert.equal(options?.includeMeta, true);
    assert.equal(options?.signal, signal);
    paths.push(path);
    return path.includes("cursor=") ? page([item]) : page([], "next+page");
  }, materialOwnerId);
  const first = await api.favoritesPage(undefined, signal);
  assert.equal(first.nextCursor, "next+page");
  assert.equal(await api.isFavorite(material.id, signal), true);
  assert.ok(
    paths.includes("/me/material-favorites?limit=100&cursor=next%2Bpage"),
  );
  const empty = createMaterialsApi(async () => page([]), materialOwnerId);
  assert.equal(await empty.isFavorite(material.id), false);
  const duplicate = createMaterialsApi(
    async () => page([item, item]),
    materialOwnerId,
  );
  await assert.rejects(duplicate.favoritesPage(), protocol);
  const hidden = createMaterialsApi(
    async () =>
      page([{ ...item, material: { ...material, status: "HIDDEN" } }]),
    materialOwnerId,
  );
  await assert.rejects(hidden.favoritesPage(), protocol);
});

test("favorite add/remove are explicit idempotent operations without token renewal replay and reject wrong targets", async () => {
  const methods: unknown[] = [];
  const api = createMaterialsApi(async (path, options) => {
    assert.equal(path, `/materials/${material.id}/favorite`);
    assert.equal(options?.replayAfterRenewal, false);
    methods.push(options?.method);
    return options?.method === "POST"
      ? { id: materialOtherId, materialId: material.id, savedAt: at }
      : { materialId: material.id, removed: false };
  }, materialOwnerId);
  assert.equal(await api.setFavorite(material.id, true), true);
  assert.equal(await api.setFavorite(material.id, false), false);
  assert.deepEqual(methods, ["POST", "DELETE"]);
  const wrong = createMaterialsApi(
    async () => ({ materialId: materialOwnerId, removed: true }),
    materialOwnerId,
  );
  await assert.rejects(wrong.setFavorite(material.id, false), protocol);
});

test("owner projection exposes the saved cover and uses signed preview with expiry guards", () => {
  const cover = {
    attached: true,
    generation: 2,
    file: {
      id: materialOtherId,
      originalFilename: "cover.png",
      mimeType: "image/png",
      sizeBytes: "10000",
      state: "ATTACHED",
      scanVerdict: "CLEAN",
    },
    processingStatus: "READY",
    failureCode: null,
    preview: {
      kind: "GENERATED",
      smallUrl: "https://example.test/s.webp",
      largeUrl: "https://example.test/l.webp",
      expiresAt: "2026-11-16T03:05:00Z",
    },
  };
  const parsed = materialSchema.parse({ ...material, cover });
  assert.equal(parsed.cover?.file?.id, materialOtherId);
  assert.equal(
    materialThumbnailUrl(parsed, true, Date.parse(at)),
    "https://example.test/l.webp",
  );
  assert.equal(
    materialThumbnailUrl(parsed, true, Date.parse("2026-11-16T03:06:00Z")),
    undefined,
  );
  assert.equal(
    materialSchema.safeParse({ ...material, cover: { ...cover, file: null } })
      .success,
    false,
  );
  assert.equal(
    materialSchema.safeParse({
      ...material,
      cover: {
        ...cover,
        attached: false,
        file: null,
        processingStatus: "NONE",
        preview: { kind: "PLACEHOLDER", format: "PDF" },
      },
    }).success,
    true,
  );
});
