import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureMaterial,
  materialOwnerId,
  materialOtherId,
} from "./fixtures/materials-data";

const page = (items: unknown[], cursor: string | null = null) => ({
  data: items,
  meta: { pagination: { limit: 20, hasMore: !!cursor, nextCursor: cursor } },
});
test("owner pages accept real file-less drafts and preserve the backend review date", async () => {
  const draft = fixtureMaterial({ file: null, scanStatus: null });
  const review = fixtureMaterial({
    id: materialOtherId,
    status: "REJECTED",
    reviewedAt: "2026-11-13T09:00:00Z",
    rejectReason: "Cần kiểm tra quyền phân phối",
  });
  const api = createMaterialsApi(
    async () => page([draft, review]),
    materialOwnerId,
  );
  const result = await api.minePage();
  assert.equal(result.items[0]!.scanStatus, null);
  assert.equal(result.items[1]!.reviewedAt, review.reviewedAt);
  const body = {
    skillId: draft.skillId,
    title: draft.title,
    description: draft.description,
    accessType: draft.accessType,
    priceCredit: draft.priceCredit,
    distributionRightsConfirmed: true as const,
  };
  const created = await createMaterialsApi(async (path, options) => {
    assert.equal(path, "/me/materials");
    assert.deepEqual(options?.body, body);
    assert.equal(options?.replayAfterRenewal, false);
    return draft;
  }, materialOwnerId).create(body);
  assert.equal(created.file, null);
  assert.equal(created.scanStatus, null);
});
test("every owner page enforces ownership and validates timestamps", async () => {
  for (const row of [
    fixtureMaterial({ ownerId: materialOtherId }),
    { ...fixtureMaterial(), reviewedAt: "bad-date" },
  ]) {
    await assert.rejects(
      createMaterialsApi(async () => page([row]), materialOwnerId).minePage(),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
});
test("owner submit and archive use exact paths without renewal replay and validate receipts", async () => {
  const calls: unknown[] = [];
  const material = fixtureMaterial();
  const api = createMaterialsApi(async (path, options) => {
    calls.push([path, options]);
    return {
      ...material,
      status: path.endsWith("/submit") ? "PENDING_REVIEW" : "ARCHIVED",
      listingVersion: material.listingVersion + 1,
    };
  }, materialOwnerId);
  await api.submit(material.id, material.listingVersion);
  await api.archive(material.id, material.listingVersion);
  assert.deepEqual(
    calls,
    ["submit", "archive"].map((action) => [
      `/me/materials/${material.id}/${action}`,
      {
        method: "POST",
        body: { expectedListingVersion: material.listingVersion },
        replayAfterRenewal: false,
      },
    ]),
  );
  for (const row of [
    fixtureMaterial({ id: materialOtherId, status: "ARCHIVED" }),
    fixtureMaterial({ ownerId: materialOtherId, status: "ARCHIVED" }),
    material,
  ]) {
    await assert.rejects(
      createMaterialsApi(async () => row, materialOwnerId).archive(
        material.id,
        1,
      ),
    );
  }
  await assert.rejects(
    createMaterialsApi(async () => material, materialOwnerId).submit(
      material.id,
      1,
    ),
  );
});
test("legacy detail reads the owned target after public 404 without scanning owner pages", async () => {
  const paths: string[] = [];
  const row = fixtureMaterial({ status: "ARCHIVED" });
  const api = createMaterialsApi(async (path) => {
    paths.push(path);
    if (path === `/materials/${row.id}`) throw new AppError("http", 404);
    assert.equal(path, `/me/materials/${row.id}`);
    return row;
  }, materialOwnerId);
  assert.equal((await api.detail(row.id)).status, "ARCHIVED");
  assert.deepEqual(paths, [`/materials/${row.id}`, `/me/materials/${row.id}`]);
});

test("owner publication permissions survive parsing, and missing permissions cannot enable editing", async () => {
  const row = fixtureMaterial({ status: "DRAFT", hasBeenPublished: true });
  const result = await createMaterialsApi(
    async () => row,
    materialOwnerId,
  ).ownerDetail(row.id);
  assert.equal(result.hasBeenPublished, true);
  assert.equal(result.canEdit, false);
  assert.equal(result.editBlockedReason, "MATERIAL_CONTENT_LOCKED");
  for (const field of [
    "hasBeenPublished",
    "canEdit",
    "editBlockedReason",
  ] as const) {
    const invalid = { ...row, [field]: undefined };
    const api = createMaterialsApi(
      async (path) => (path.includes("?") ? page([invalid]) : invalid),
      materialOwnerId,
    );
    await assert.rejects(
      api.ownerDetail(row.id),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
    await assert.rejects(
      api.minePage(),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
  const { hasBeenPublished, canEdit, editBlockedReason, ...publicRow } =
    fixtureMaterial({ status: "PUBLISHED" });
  assert.equal(hasBeenPublished, true);
  assert.equal(canEdit, false);
  assert.equal(editBlockedReason, "MATERIAL_CONTENT_LOCKED");
  assert.equal(
    (
      await createMaterialsApi(
        async () => publicRow,
        materialOtherId,
      ).publicDetail(row.id)
    ).id,
    row.id,
  );
});

test("submit and archive reject invalid versions before dispatch, stale receipts and preserve backend conflicts", async () => {
  const row = fixtureMaterial();
  for (const action of ["submit", "archive"] as const) {
    let calls = 0;
    const api = createMaterialsApi(async () => {
      calls++;
      return fixtureMaterial({
        status: action === "submit" ? "PENDING_REVIEW" : "ARCHIVED",
        listingVersion: 4,
      });
    }, materialOwnerId);
    for (const invalid of [0, -1, 1.5, NaN, Infinity])
      await assert.rejects(api[action](row.id, invalid));
    assert.equal(calls, 0);
    await assert.rejects(
      api[action](row.id, 4),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
    const conflict = new AppError("http", 409, "MATERIAL_VERSION_CONFLICT");
    const stale = createMaterialsApi(async () => {
      throw conflict;
    }, materialOwnerId);
    await assert.rejects(
      stale[action](row.id, 4),
      (error) => error === conflict,
    );
  }
});
