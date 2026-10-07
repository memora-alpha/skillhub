import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nameKey,
  skillSlug,
  verificationBadge,
  page,
  readCursor,
  text,
} from "../../dist/modules/skills/domain/skill-policy.js";
test("Vietnamese catalog normalization preserves accents and NFC while collapsing whitespace", () => {
  assert.equal(nameKey("  Kỹ   NĂNG  "), nameKey("Kỹ năng"));
  assert.equal(nameKey("Kỹ năng".normalize("NFD")), "kỹ năng");
  assert.notEqual(nameKey("Kỹ năng"), nameKey("Ky nang"));
  assert.equal(skillSlug("Đàn Guitar"), "dan-guitar");
  assert.throws(() => text("a", 2, 100));
  assert.equal(text("🙂🙂", 2, 2), "🙂🙂");
});
test("pending/rejected replacements never invalidate an existing approved evidence", () => {
  assert.equal(verificationBadge(1, 1, 2), "VERIFIED");
  assert.equal(verificationBadge(1, 0, 2), "VERIFIED");
  assert.equal(verificationBadge(0, 1, 2), "PENDING");
  assert.equal(verificationBadge(0, 0, 2), "REJECTED");
  assert.equal(verificationBadge(0, 0, 0), "UNVERIFIED");
});
test("cursor is tied to filters and rejects malformed identifiers", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const result = page(
    [
      { id, name: "abc" },
      { id, name: "def" },
    ],
    1,
    "scope",
    (row) => row.name,
  );
  assert.equal(result.pagination.hasMore, true);
  assert.equal(readCursor(result.pagination.nextCursor, "scope").id, id);
  assert.throws(() => readCursor(result.pagination.nextCursor, "other"));
  assert.throws(() => readCursor("%%%", "scope"));
});
