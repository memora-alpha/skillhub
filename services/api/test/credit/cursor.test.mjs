import assert from "node:assert/strict";
import { test } from "node:test";
import { LedgerCursor } from "../../dist/modules/credit/domain/ledger-cursor.js";

test("ledger cursor is authenticated and bound to owner, filters and watermark", () => {
  const codec = new LedgerCursor("fixture-secret");
  const scope = { userId: "owner", type: "TOP_UP", referenceType: undefined };
  const token = codec.encode(scope, 100n, 90n);
  assert.deepEqual(codec.decode(token, scope), {
    watermark: 100n,
    before: 90n,
  });
  assert.throws(() => codec.decode(token, { ...scope, userId: "other" }));
  assert.throws(() => codec.decode(token, { ...scope, type: "HOLD" }));
  assert.throws(() => codec.decode(`${token}changed`, scope));
  assert.throws(() => new LedgerCursor("another-key").decode(token, scope));
  assert.throws(() => codec.decode("not-a-cursor", scope));
});
