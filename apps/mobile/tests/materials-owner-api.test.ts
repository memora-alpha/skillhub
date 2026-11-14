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
    };
  }, materialOwnerId);
  await api.submit(material.id);
  await api.archive(material.id);
  assert.deepEqual(
    calls,
    ["submit", "archive"].map((action) => [
      `/me/materials/${material.id}/${action}`,
      {
        method: "POST",
        body: undefined,
        idempotencyKey: undefined,
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
      createMaterialsApi(async () => row, materialOwnerId).archive(material.id),
    );
  }
  await assert.rejects(
    createMaterialsApi(async () => material, materialOwnerId).submit(
      material.id,
    ),
  );
});
test("owner reconciliation follows opaque cursors and does not mistake the first page for the full list", async () => {
  const paths: string[] = [];
  const api = createMaterialsApi(async (path) => {
    paths.push(path);
    return paths.length === 1
      ? page([fixtureMaterial()], "next/+cursor")
      : page([fixtureMaterial({ id: materialOtherId, status: "ARCHIVED" })]);
  }, materialOwnerId);
  const result = await api.mine();
  assert.equal(result.length, 2);
  assert.match(paths[1]!, /cursor=next%2F%2Bcursor/);
});
