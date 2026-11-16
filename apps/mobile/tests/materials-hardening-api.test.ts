import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import { AppError } from "../src/lib/http/errors";
import { filePickerError } from "../src/lib/http/file-picker-error";
import {
  fixtureMaterial,
  materialOtherId,
  materialOwnerId,
} from "./fixtures/materials-data";

const at = "2026-11-16T03:00:00Z";
const material = fixtureMaterial({
  status: "PUBLISHED",
  accessType: "FREE",
  priceCredit: "0",
});
const access = {
  accessSource: "FREE_PUBLIC",
  firstAccessedAt: at,
  lastAccessedAt: at,
  material,
};
const page = (data: unknown[], cursor: string | null = null) => ({
  data,
  meta: { pagination: { limit: 20, hasMore: !!cursor, nextCursor: cursor } },
});
const protocol = (error: unknown) =>
  error instanceof AppError && error.kind === "protocol";

test("a missing deployed free-library route is unavailable, while permission and resource errors retain their meaning", async () => {
  const missing = createMaterialsApi(async () => {
    throw new AppError("http", 404);
  }, materialOwnerId);
  await assert.rejects(
    missing.freeLibraryPage(),
    (error: unknown) =>
      error instanceof AppError &&
      error.status === 404 &&
      error.code === "MATERIAL_FREE_LIBRARY_UNAVAILABLE",
  );
  for (const failure of [
    new AppError("http", 403, "MATERIAL_PERMISSION_REQUIRED"),
    new AppError("http", 404, "MATERIAL_NOT_FOUND"),
    new AppError("network"),
  ]) {
    const api = createMaterialsApi(async () => {
      throw failure;
    }, materialOwnerId);
    await assert.rejects(
      api.freeLibraryPage(),
      (error: unknown) => error === failure,
    );
  }
});

test("free library preserves server cursor, timestamps and thumbnail, with a stable material identity", async () => {
  const signal = new AbortController().signal;
  const calls: string[] = [];
  const api = createMaterialsApi(async (path, options) => {
    calls.push(path);
    assert.equal(options?.includeMeta, true);
    assert.equal(options?.signal, signal);
    return page(
      [access, { ...access, material: { ...material, id: materialOtherId } }],
      "next+page",
    );
  }, materialOwnerId);
  const result = await api.freeLibraryPage(undefined, signal);
  assert.deepEqual(
    result.items.map((row) => row.id),
    [material.id, materialOtherId],
  );
  assert.equal(result.items[0]!.lastAccessedAt, at);
  await api.freeLibraryPage(result.nextCursor!, signal);
  assert.equal(
    calls[1],
    "/me/material-library/free?limit=20&cursor=next%2Bpage",
  );
  for (const rows of [
    [access, access],
    [{ ...access, accessSource: "PURCHASE" }],
    [{ ...access, lastAccessedAt: "2026-11-15T03:00:00Z" }],
    [{ ...access, material: { ...material, status: "HIDDEN" } }],
    [
      {
        ...access,
        material: { ...material, accessType: "PAID", priceCredit: "10" },
      },
    ],
  ]) {
    const invalid = createMaterialsApi(async () => page(rows), materialOwnerId);
    await assert.rejects(invalid.freeLibraryPage(), protocol);
  }
});

test("draft deletion validates the receipt, uses the exact version and never enables renewal replay", async () => {
  let count = 0;
  const api = createMaterialsApi(async (path, options) => {
    count++;
    assert.equal(path, `/me/materials/${material.id}?expectedListingVersion=7`);
    assert.equal(options?.method, "DELETE");
    assert.equal(options?.replayAfterRenewal, false);
    return { id: material.id, deleted: true, replayed: true };
  }, materialOwnerId);
  assert.equal((await api.deleteDraft(material.id, 7)).replayed, true);
  await assert.rejects(api.deleteDraft(material.id, 0), protocol);
  assert.equal(count, 1);
  for (const receipt of [
    { id: materialOtherId, deleted: true, replayed: false },
    { id: material.id, deleted: false, replayed: false },
    { id: material.id, deleted: true },
  ]) {
    const invalid = createMaterialsApi(async () => receipt, materialOwnerId);
    await assert.rejects(invalid.deleteDraft(material.id, 7), protocol);
  }
});

test("review editability comes from live eligibility and rejects contradictory or hidden editable responses", async () => {
  const currentReview = {
    id: materialOtherId,
    materialId: material.id,
    rating: 5,
    comment: null,
    status: "VISIBLE",
    version: 1,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
  const value = {
    canReview: false,
    reasonCode: "MATERIAL_REVIEW_ALREADY_EXISTS",
    canEdit: false,
    editReasonCode: "MATERIAL_ENTITLEMENT_REVOKED",
    currentReview,
  };
  let response: unknown = value;
  const api = createMaterialsApi(async () => response, materialOwnerId);
  assert.equal((await api.reviewEligibility(material.id)).canEdit, false);
  response = { ...value, canEdit: true, editReasonCode: null };
  assert.equal((await api.reviewEligibility(material.id)).canEdit, true);
  for (const invalid of [
    { ...value, canEdit: true },
    { ...value, editReasonCode: null },
    {
      ...value,
      canEdit: true,
      editReasonCode: null,
      currentReview: { ...currentReview, status: "HIDDEN" },
    },
    { ...value, canEdit: true, editReasonCode: null, currentReview: null },
  ]) {
    response = invalid;
    await assert.rejects(api.reviewEligibility(material.id), protocol);
  }
  response = { canReview: false, reasonCode: value.reasonCode, currentReview };
  assert.equal(
    (await api.reviewEligibility(material.id)).canEdit,
    undefined,
    "legacy API does not grant edit permission",
  );
});

test("Office expansion failures explain decompression safety rather than uploaded file size", () => {
  const message = filePickerError(
    new AppError("http", 413, "FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED"),
    "upload",
  );
  assert.match(message, /giải nén/);
  assert.doesNotMatch(message, /20 MB|15 MB/);
  assert.match(
    filePickerError(new AppError("http", 413), "upload"),
    /dung lượng/,
  );
});
