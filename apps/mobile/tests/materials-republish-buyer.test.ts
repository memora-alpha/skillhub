import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import type { MaterialOrder } from "../src/features/materials/api/material-contracts";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureMaterial,
  materialOtherId,
  materialOwnerId,
} from "./fixtures/materials-data";

test("ownership retains its original snapshot across archive and unchanged republication; changed content requires a separate listing ID", async () => {
  const original = fixtureMaterial({
    status: "PUBLISHED",
    accessType: "PAID",
    priceCredit: "10.00",
  });
  const order: MaterialOrder = {
    id: materialOtherId,
    materialId: original.id,
    sellerId: materialOwnerId,
    listingVersion: 1,
    status: "SUCCESS",
    grossCredit: "10.00",
    feeAmount: "0.40",
    sellerNetCredit: "9.60",
    createdAt: original.createdAt,
    purchasedMaterial: { title: original.title, ...original.file! },
  };
  const requests: string[] = [];
  for (const current of [
    { ...original, status: "ARCHIVED" as const, listingVersion: 2 },
    { ...original, listingVersion: 4 },
  ]) {
    const api = createMaterialsApi(async (path, options) => {
      requests.push(path);
      assert.notEqual(
        options?.method,
        "POST",
        "reading ownership cannot buy again",
      );
      if (path.startsWith("/me/material-orders?"))
        return {
          data: [order],
          meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
        };
      if (path === `/materials/${original.id}`) {
        if (current.status === "ARCHIVED")
          throw new AppError("http", 404, "MATERIAL_NOT_FOUND");
        return current;
      }
      throw Error("Unexpected request " + path);
    }, materialOtherId);
    const owned = await api.ownedOrder(original.id);
    assert.deepEqual(owned, order);
    assert.equal(owned?.listingVersion, 1);
    assert.equal(owned?.grossCredit, "10.00");
    assert.equal(
      owned?.purchasedMaterial?.originalFilename,
      original.file?.originalFilename,
    );
    if (current.status === "ARCHIVED")
      await assert.rejects(api.publicDetail(original.id));
    else {
      const listing = await api.publicDetail(original.id);
      assert.equal(listing.listingVersion, current.listingVersion);
      assert.equal(listing.priceCredit, current.priceCredit);
      assert.equal(
        listing.file?.originalFilename,
        current.file?.originalFilename,
      );
    }
    assert.equal(
      await api.ownedOrder("123e4567-e89b-42d3-a456-000000000099"),
      null,
      "a different listing ID is a separate purchase",
    );
  }
  assert.equal(
    requests.some(
      (path) => path.endsWith("/purchase") || path.endsWith("/download"),
    ),
    false,
  );
  const newListing = fixtureMaterial({
    id: "123e4567-e89b-42d3-a456-000000000099",
    status: "PUBLISHED",
    title: "Tài liệu nội dung mới",
    accessType: "PAID",
    priceCredit: "50.00",
    file: { ...original.file!, originalFilename: "ban-moi.pdf" },
  });
  const api = createMaterialsApi(async (path) => {
    if (path === `/materials/${newListing.id}`) return newListing;
    if (path.startsWith("/me/material-orders?"))
      return {
        data: [order],
        meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
      };
    throw Error("Unexpected request " + path);
  }, materialOtherId);
  assert.equal(await api.ownedOrder(newListing.id), null);
  assert.equal(
    (await api.publicDetail(newListing.id)).file?.originalFilename,
    "ban-moi.pdf",
  );
  assert.equal((await api.ownedOrder(original.id))?.grossCredit, "10.00");
});
