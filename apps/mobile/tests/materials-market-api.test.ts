import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureMaterial,
  materialOwnerId,
  materialOtherId,
} from "./fixtures/materials-data";
const row = fixtureMaterial({
  status: "PUBLISHED",
  ownerId: materialOtherId,
  accessType: "PAID",
  priceCredit: "25.50",
});
const order = {
  id: materialOtherId,
  materialId: row.id,
  sellerId: row.ownerId,
  listingVersion: 1,
  grossCredit: "25.50",
  feeAmount: "1.27",
  sellerNetCredit: "24.23",
  status: "SUCCESS",
  createdAt: row.createdAt,
};
test("catalog sends server search/access/skill filters and derives next page and total from metadata", async () => {
  let request = "";
  const api = createMaterialsApi(async (path) => {
    request = path;
    return {
      data: [row],
      meta: { pagination: { page: 2, limit: 20, total: 41 } },
    };
  }, materialOwnerId);
  const result = await api.search(
    "giao tiếp",
    "PAID",
    2,
    undefined,
    row.skillId,
  );
  const url = new URL(request, "https://fixture");
  assert.equal(url.searchParams.get("skillId"), row.skillId);
  assert.equal(url.searchParams.get("q"), "giao tiếp");
  assert.equal(url.searchParams.get("accessType"), "PAID");
  assert.equal(result.nextPage, 3);
  assert.equal(result.total, 41);
});

test("related material adapter reads real catalog by skill, forwards abort and excludes current/other-skill content with a four-item cap", async () => {
  const controller = new AbortController();
  let reads = 0;
  const data = [
    row,
    ...Array.from({ length: 6 }, (_, index) => ({
      ...row,
      id: `123e4567-e89b-42d3-a456-${String(index + 101).padStart(12, "0")}`,
    })),
    {
      ...row,
      id: "123e4567-e89b-42d3-a456-000000000200",
      skillId: materialOwnerId,
    },
  ];
  const api = createMaterialsApi(async (path, options) => {
    reads++;
    const url = new URL(path, "https://fixture");
    assert.equal(url.pathname, "/materials");
    assert.equal(url.searchParams.get("skillId"), row.skillId);
    assert.equal(url.searchParams.get("page"), "1");
    assert.equal(options?.signal, controller.signal);
    return {
      data,
      meta: { pagination: { page: 1, limit: 20, total: data.length } },
    };
  }, materialOwnerId);
  const result = await api.related(row.id, row.skillId, controller.signal);
  assert.equal(reads, 1);
  assert.equal(result.length, 4);
  assert.ok(
    result.every((item) => item.id !== row.id && item.skillId === row.skillId),
  );
  await assert.rejects(api.related("invalid-id", row.skillId));
  assert.equal(reads, 1);
});
test("catalog rejects wrong pages, duplicate rows and unpublished content; public previews never fall back to own drafts", async () => {
  for (const payload of [
    { data: [row], meta: { pagination: { page: 2, limit: 20, total: 1 } } },
    {
      data: [row, row],
      meta: { pagination: { page: 1, limit: 20, total: 2 } },
    },
    {
      data: [{ ...row, status: "DRAFT" }],
      meta: { pagination: { page: 1, limit: 20, total: 1 } },
    },
  ])
    await assert.rejects(
      createMaterialsApi(async () => payload, materialOwnerId).search(),
    );
  const paths: string[] = [];
  await assert.rejects(
    createMaterialsApi(async (path) => {
      paths.push(path);
      throw new AppError("http", 404);
    }, materialOwnerId).publicDetail(row.id),
  );
  assert.equal(paths.length, 1);
});
test("purchase freezes version and idempotency key, preserves refunded replay status and validates target receipts", async () => {
  const calls: unknown[] = [];
  const api = createMaterialsApi(async (path, options) => {
    calls.push([path, options]);
    return { ...order, status: "REFUNDED" };
  }, materialOwnerId);
  const result = await api.purchase(row.id, 1, "stable-key");
  assert.equal(result.status, "REFUNDED");
  assert.deepEqual(calls, [
    [
      `/materials/${row.id}/purchase`,
      {
        method: "POST",
        body: { expectedListingVersion: 1 },
        idempotencyKey: "stable-key",
        replayAfterRenewal: false,
      },
    ],
  ]);
  await assert.rejects(api.purchase(row.id, 0, "stable-key"));
  await assert.rejects(api.purchase(row.id, 1, "bad key"));
  assert.equal(calls.length, 1);
  await assert.rejects(
    createMaterialsApi(
      async () => ({ ...order, materialId: materialOtherId }),
      materialOwnerId,
    ).purchase(row.id, 1, "stable-key"),
  );
});
test("ownership follows cursors and only active SUCCESS orders count; refunds require a matching REFUNDED receipt", async () => {
  let reads = 0;
  const api = createMaterialsApi(async () => {
    reads++;
    return {
      data: [{ ...order, status: reads === 1 ? "REFUNDED" : "SUCCESS" }],
      meta: {
        pagination: {
          limit: 20,
          hasMore: reads === 1,
          nextCursor: reads === 1 ? "next" : null,
        },
      },
    };
  }, materialOwnerId);
  assert.equal((await api.ownedOrder(row.id))?.status, "SUCCESS");
  assert.equal(reads, 2);
  await assert.rejects(
    createMaterialsApi(async () => order, materialOwnerId).refund(order.id),
  );
});
test("download URLs are requested only explicitly without renewal replay and reject expired or unsafe locations", async () => {
  let reads = 0;
  const api = createMaterialsApi(async (path, options) => {
    reads++;
    assert.equal(path, `/materials/${row.id}/download`);
    assert.equal(options?.replayAfterRenewal, false);
    return {
      url: "https://files.example.test/signed",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }, materialOwnerId);
  assert.equal(reads, 0);
  await api.download(row.id);
  assert.equal(reads, 1);
  for (const file of [
    {
      url: "javascript:alert(1)",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    {
      url: "https://files.example.test/signed",
      expiresAt: "2020-01-01T00:00:00Z",
    },
  ])
    await assert.rejects(
      createMaterialsApi(async () => file, materialOwnerId).download(row.id),
    );
});
