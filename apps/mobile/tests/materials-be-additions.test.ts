import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import { materialSchema } from "../src/features/materials/api/material-contracts";
import { editorMaterialInput } from "../src/features/materials/utils/material-editor-schema";
import { materialThumbnailUrl } from "../src/features/materials/utils/material-thumbnail";
import { prepareMaterialCoverUpload } from "../src/features/materials/utils/material-cover-upload";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureMaterial,
  materialOwnerId,
  materialOtherId,
} from "./fixtures/materials-data";
import { notificationTarget } from "../src/features/notifications/utils/notification-target";
import { notificationCopy } from "../src/features/notifications/utils/notification-copy";

const material = fixtureMaterial({ status: "PUBLISHED" });
const at = "2026-11-15T10:00:00Z";
const own = {
  id: materialOtherId,
  materialId: material.id,
  rating: 4,
  comment: "Useful",
  status: "VISIBLE",
  version: 2,
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
};
const summary = {
  average: "4.00",
  total: 1,
  stars: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
};
const publicReview = {
  ...own,
  reviewer: { userId: materialOwnerId, fullName: "Người học", avatarUrl: null },
  verifiedPurchase: true,
};
const page = {
  data: [publicReview],
  meta: {
    pagination: { limit: 20, hasMore: true, nextCursor: "opaque" },
    ratingSummary: summary,
  },
};
const protocol = (error: unknown) =>
  error instanceof AppError && error.kind === "protocol";

test("material review page parses the BE stars summary and forwards opaque paging and cancellation", async () => {
  const signal = new AbortController().signal;
  const api = createMaterialsApi(async (path, options) => {
    assert.equal(
      path,
      `/materials/${material.id}/reviews?limit=20&cursor=opaque%2Bcursor`,
    );
    assert.deepEqual(options, { includeMeta: true, signal });
    return page;
  }, materialOwnerId);
  const result = await api.reviews(material.id, "opaque+cursor", signal);
  assert.deepEqual(result.summary, summary);
  assert.equal(result.nextCursor, "opaque");
  assert.equal(result.items[0]?.verifiedPurchase, true);
  for (const value of [
    { ...page, data: [publicReview, publicReview] },
    { ...page, data: [{ ...publicReview, status: "HIDDEN" }] },
    {
      ...page,
      meta: { ...page.meta, ratingSummary: { ...summary, total: 2 } },
    },
    {
      ...page,
      meta: { ...page.meta, ratingSummary: { ...summary, average: "5.00" } },
    },
  ])
    await assert.rejects(
      createMaterialsApi(async () => value, materialOwnerId).reviews(
        material.id,
      ),
      protocol,
    );
});

test("eligibility preserves the hidden own review and rejects mismatched or contradictory permissions", async () => {
  const api = createMaterialsApi(
    async () => ({
      canReview: false,
      reasonCode: "MATERIAL_REVIEW_HIDDEN",
      currentReview: { ...own, status: "HIDDEN" },
    }),
    materialOwnerId,
  );
  assert.equal(
    (await api.reviewEligibility(material.id)).currentReview?.status,
    "HIDDEN",
  );
  for (const value of [
    {
      canReview: true,
      reasonCode: "MATERIAL_ACCESS_REQUIRED",
      currentReview: null,
    },
    { canReview: true, reasonCode: null, currentReview: own },
    {
      canReview: false,
      reasonCode: "MATERIAL_REVIEW_ALREADY_EXISTS",
      currentReview: { ...own, materialId: materialOtherId },
    },
    {
      canReview: false,
      reasonCode: "MATERIAL_REVIEW_ALREADY_EXISTS",
      currentReview: { ...own, deletedAt: at },
    },
  ])
    await assert.rejects(
      createMaterialsApi(async () => value, materialOwnerId).reviewEligibility(
        material.id,
      ),
      protocol,
    );
});

test("review writes keep the explicit key, exact version, clearing comment and disable renewal replay", async () => {
  const calls: unknown[] = [];
  const api = createMaterialsApi(async (path, options) => {
    calls.push({ path, ...options });
    return options?.method === "DELETE"
      ? { review: { ...own, deletedAt: at }, replayed: false }
      : own;
  }, materialOwnerId);
  await api.createReview(
    material.id,
    { rating: 4, comment: " Useful " },
    "same-key",
  );
  await api.updateReview(material.id, own.id, 2, { rating: 4, comment: "" });
  await api.deleteReview(material.id, own.id, 2);
  assert.deepEqual(calls, [
    {
      path: `/materials/${material.id}/reviews`,
      method: "POST",
      body: { rating: 4, comment: "Useful" },
      idempotencyKey: "same-key",
      replayAfterRenewal: false,
    },
    {
      path: `/material-reviews/${own.id}`,
      method: "PATCH",
      body: { rating: 4, comment: "", expectedVersion: 2 },
      replayAfterRenewal: false,
    },
    {
      path: `/material-reviews/${own.id}?expectedVersion=2`,
      method: "DELETE",
      replayAfterRenewal: false,
    },
  ]);
  const before = calls.length;
  await assert.rejects(
    api.createReview(material.id, { rating: 4 }, ""),
    protocol,
  );
  await assert.rejects(
    api.updateReview(material.id, own.id, 0, { rating: 4 }),
    protocol,
  );
  await assert.rejects(
    api.createReview(material.id, { rating: 6 }, "key"),
    protocol,
  );
  assert.equal(calls.length, before);
  await assert.rejects(
    createMaterialsApi(
      async () => ({ ...own, materialId: materialOtherId }),
      materialOwnerId,
    ).createReview(material.id, { rating: 4 }, "key"),
    protocol,
  );
  await assert.rejects(
    createMaterialsApi(
      async () => ({ review: own, replayed: false }),
      materialOwnerId,
    ).deleteReview(material.id, own.id, 2),
    protocol,
  );
});

test("review reports validate the target and do not retry permission failures", async () => {
  let count = 0;
  const api = createMaterialsApi(async (path, options) => {
    count++;
    assert.equal(path, `/material-reviews/${own.id}/reports`);
    assert.equal(options?.replayAfterRenewal, false);
    assert.deepEqual(options?.body, {
      reasonCode: "OTHER",
      description: "Nội dung đánh giá không phù hợp",
    });
    return { id: material.id, reviewId: own.id, status: "OPEN", createdAt: at };
  }, materialOwnerId);
  await api.reportReview(own.id, "Nội dung đánh giá không phù hợp");
  assert.equal(count, 1);
  const denied = new AppError("http", 403);
  await assert.rejects(
    createMaterialsApi(async () => {
      throw denied;
    }, materialOwnerId).reviews(material.id),
    (error) => error === denied,
  );
});

test("cover upload, preserve, replace and explicit removal follow scanner state and create/PATCH contracts", async () => {
  const values = {
    skillId: material.skillId,
    title: material.title,
    description: material.description,
    accessType: material.accessType,
    priceCredit: material.priceCredit,
    rights: true,
  };
  const cover = { fileId: materialOtherId, state: "READY", name: "cover.png" };
  assert.equal(editorMaterialInput(values).coverFileId, undefined);
  assert.equal(
    editorMaterialInput(values, undefined, cover).coverFileId,
    cover.fileId,
  );
  assert.throws(() =>
    editorMaterialInput(values, undefined, { ...cover, state: "SCANNING" }),
  );
  const requests: { path: string; body?: unknown }[] = [];
  const api = createMaterialsApi(async (path, options) => {
    requests.push({ path, ...options });
    return path.endsWith("cover-files") ? cover : material;
  }, materialOwnerId);
  const body = new FormData();
  await api.uploadCover(body);
  assert.deepEqual(requests.at(-1), {
    path: "/me/materials/cover-files",
    method: "POST",
    body,
    multipart: true,
    replayAfterRenewal: false,
  });
  await api.update(material.id, material.listingVersion, {
    ...editorMaterialInput(values),
    coverFileId: null,
  });
  assert.deepEqual(requests.at(-1)?.body, {
    ...editorMaterialInput(values),
    coverFileId: null,
    expectedListingVersion: material.listingVersion,
  });
  await assert.rejects(
    api.create({ ...editorMaterialInput(values), coverFileId: null }),
    protocol,
  );
  for (const name of ["cover.gif", "cover.svg", "document.pdf"])
    assert.throws(() =>
      prepareMaterialCoverUpload({
        name,
        uri: "file:///cover",
        lastModified: 0,
        mimeType: "image/png",
      }),
    );
  assert.equal(
    prepareMaterialCoverUpload({
      name: "cover.PNG",
      uri: "file:///cover",
      lastModified: 0,
      mimeType: "application/octet-stream",
    }).mimeType,
    "image/png",
  );
  assert.throws(() =>
    prepareMaterialCoverUpload({
      name: "cover.png",
      uri: "file:///cover",
      lastModified: 0,
      mimeType: "image/jpeg",
    }),
  );
});

test("signed thumbnails only render before expiry; summaries never invent rating from malformed data", () => {
  const row = materialSchema.parse({
    ...material,
    ratingSummary: summary,
    thumbnail: {
      kind: "GENERATED",
      smallUrl: "https://assets.example/small",
      largeUrl: "https://assets.example/large",
      expiresAt: at,
    },
  });
  assert.equal(
    materialThumbnailUrl(row, false, Date.parse(at) - 1),
    "https://assets.example/small",
  );
  assert.equal(
    materialThumbnailUrl(row, true, Date.parse(at) - 1),
    "https://assets.example/large",
  );
  assert.equal(materialThumbnailUrl(row, true, Date.parse(at)), undefined);
  assert.equal(materialThumbnailUrl(material, false, 0), undefined);
  assert.equal(
    materialSchema.safeParse({
      ...row,
      thumbnail: { ...row.thumbnail, smallUrl: "javascript:bad" },
    }).success,
    false,
  );
  assert.equal(
    materialSchema.safeParse({
      ...row,
      ratingSummary: { ...summary, average: "5.50" },
    }).success,
    false,
  );
});

test("material review notifications use validated IDs and translated server templates", () => {
  const item = {
    id: material.id,
    type: "material.review.created",
    title: "New material review",
    body: "A learner reviewed your material.",
    payload: { materialId: material.id, reviewId: own.id },
    readAt: null,
    createdAt: at,
  };
  assert.deepEqual(notificationTarget(item), {
    pathname: "/materials/[id]",
    params: { id: material.id },
  });
  assert.equal(
    notificationTarget({
      ...item,
      payload: { materialId: "javascript:bad", reviewId: own.id },
    }),
    undefined,
  );
  assert.equal(notificationCopy(item).title, "Có đánh giá tài liệu mới");
});
