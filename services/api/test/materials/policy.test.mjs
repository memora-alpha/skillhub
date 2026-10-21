import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPublishableFile,
  listingText,
  materialFee,
  moderationTransition,
  priceUnits,
  snapshotStorageKey,
  statusAfterEdit,
} from "../../dist/modules/materials/domain/material.policy.js";

test("FREE must be 0 and PAID must be positive with two decimals", () => {
  assert.equal(priceUnits("FREE", "0"), 0n);
  assert.equal(priceUnits("PAID", "12.5"), 1250n);
  assert.throws(() => priceUnits("FREE", "1"), /MATERIAL_PRICE_INVALID/);
  assert.throws(() => priceUnits("PAID", "0"), /MATERIAL_PRICE_INVALID/);
  for (const bad of ["1.001", "abc", "-1", ""])
    assert.throws(() => priceUnits("PAID", bad), /MATERIAL_PRICE_INVALID/);
});

test("listing text is trimmed and bounded", () => {
  assert.deepEqual(
    listingText({ title: "  Docker  ", description: "  Ten chars!  " }),
    { title: "Docker", description: "Ten chars!" },
  );
  assert.throws(
    () => listingText({ title: "   abc   ", description: "long enough text" }),
    /MATERIAL_TEXT_INVALID/,
  );
});

test("listing text counts code points like PostgreSQL char_length", () => {
  const description = "long enough text";
  // Four emoji are 8 UTF-16 units but 4 characters: too short for the CHECK.
  assert.throws(
    () => listingText({ title: "🐳🐳🐳🐳", description }),
    /MATERIAL_TEXT_INVALID/,
  );
  assert.equal(
    listingText({ title: "🐳".repeat(150), description }).title.length,
    300,
  );
  assert.throws(
    () => listingText({ title: "🐳".repeat(151), description }),
    /MATERIAL_TEXT_INVALID/,
  );
});

test("editing a live listing sends it back to review", () => {
  assert.equal(statusAfterEdit("PUBLISHED"), "PENDING_REVIEW");
  assert.equal(statusAfterEdit("REJECTED"), "DRAFT");
  assert.equal(statusAfterEdit("DRAFT"), "DRAFT");
  assert.equal(statusAfterEdit("PENDING_REVIEW"), "PENDING_REVIEW");
  assert.throws(() => statusAfterEdit("HIDDEN"), /MATERIAL_NOT_EDITABLE/);
  assert.throws(() => statusAfterEdit("ARCHIVED"), /MATERIAL_NOT_EDITABLE/);
});

test("moderation only follows the state machine", () => {
  assert.deepEqual(moderationTransition("approve", "PENDING_REVIEW"), {
    status: "PUBLISHED",
    decision: "APPROVED",
  });
  assert.deepEqual(moderationTransition("reject", "PENDING_REVIEW"), {
    status: "REJECTED",
    decision: "REJECTED",
  });
  assert.deepEqual(moderationTransition("hide", "PUBLISHED"), {
    status: "HIDDEN",
    decision: "HIDDEN",
  });
  assert.deepEqual(moderationTransition("unhide", "HIDDEN"), {
    status: "PUBLISHED",
    decision: "APPROVED",
  });
  assert.throws(
    () => moderationTransition("approve", "DRAFT"),
    /MATERIAL_TRANSITION_INVALID/,
  );
  assert.throws(
    () => moderationTransition("unhide", "PUBLISHED"),
    /MATERIAL_TRANSITION_INVALID/,
  );
});

test("5% fee floors to hundredths and gross = fee + net", () => {
  assert.deepEqual(materialFee(10000n, 500), { fee: 500n, net: 9500n });
  assert.deepEqual(materialFee(1999n, 500), { fee: 99n, net: 1900n });
  assert.deepEqual(materialFee(1n, 500), { fee: 0n, net: 1n });
  for (const bad of [-1, 10000, 2.5, "500", undefined]) {
    assert.throws(
      () => materialFee(100n, bad),
      /MATERIAL_FEE_POLICY_UNAVAILABLE/,
    );
  }
});

test("publishing needs a clean rights-confirmed file", () => {
  const ok = {
    storageKey: "private/x",
    scanStatus: "CLEAN",
    distributionRightsConfirmedAt: new Date(),
  };
  assert.doesNotThrow(() => assertPublishableFile(ok));
  for (const patch of [
    { storageKey: null },
    { scanStatus: "INFECTED" },
    { distributionRightsConfirmedAt: null },
  ]) {
    assert.throws(
      () => assertPublishableFile({ ...ok, ...patch }),
      /MATERIAL_FILE_REQUIRED/,
    );
  }
  assert.equal(snapshotStorageKey({ storageKey: "private/y" }), "private/y");
  assert.throws(() => snapshotStorageKey({}), /MATERIAL_FILE_REQUIRED/);
});
