import assert from "node:assert/strict";
import { test } from "node:test";
import { materialOwnershipStatus } from "../src/features/materials/utils/material-ownership-presentation";

test("detail purchase badge distinguishes a confirmed absence from pending or failed ownership reads", () => {
  const state = {
    own: false,
    free: false,
    purchased: false,
    resolved: false,
    error: false,
  };
  assert.equal(materialOwnershipStatus(state), "checking");
  assert.equal(
    materialOwnershipStatus({ ...state, error: true }),
    "unverified",
  );
  assert.equal(
    materialOwnershipStatus({ ...state, resolved: true }),
    "unpurchased",
  );
  assert.equal(
    materialOwnershipStatus({ ...state, resolved: true, purchased: true }),
    "purchased",
  );
  assert.equal(
    materialOwnershipStatus({
      ...state,
      resolved: true,
      purchased: true,
      error: true,
    }),
    "unverified",
  );
});

test("detail differentiates owner/free access and retains a confirmed purchase when the current listing becomes free", () => {
  const state = {
    own: false,
    free: true,
    purchased: false,
    resolved: false,
    error: false,
  };
  assert.equal(materialOwnershipStatus(state), "free");
  assert.equal(materialOwnershipStatus({ ...state, own: true }), "own");
  assert.equal(
    materialOwnershipStatus({ ...state, resolved: true, purchased: true }),
    "purchased",
  );
});
