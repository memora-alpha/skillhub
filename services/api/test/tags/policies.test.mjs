import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";

import * as policy from "../../dist/modules/skills/domain/tag-policy.js";

test("tag normalization preserves accents and symbols with a bounded Unicode label", () => {
  const normalize = policy.normalizeTagLabel;
  assert.deepEqual(normalize("  Kỹ   NĂNG "), {
    label: "Kỹ NĂNG",
    labelKey: "kỹ năng",
  });
  assert.equal(normalize("Kỹ năng".normalize("NFD")).labelKey, "kỹ năng");
  assert.equal(normalize(" javascript ").labelKey, "javascript");
  assert.equal(normalize("JAVASCRIPT").labelKey, "javascript");
  assert.notEqual(normalize("C++").labelKey, normalize("C#").labelKey);
  assert.notEqual(normalize("C").labelKey, normalize("C#").labelKey);
  assert.notEqual(normalize("Ky nang").labelKey, normalize("Kỹ năng").labelKey);
  assert.equal(normalize("🙂".repeat(80)).label.length, 160);
  for (const value of [
    "",
    " ",
    "a".repeat(81),
    "a\tb",
    "a\nb",
    "a\0b",
    null,
    123,
  ]) {
    assert.throws(
      () => normalize(value),
      (error) => error.getStatus() === 400,
    );
  }
});

test("tag input schemas reject forged metadata, empty patches and invalid versions", () => {
  const parse = policy.parseTagInput;
  for (const value of [
    { label: "Node", createdByUserId: "forged" },
    { label: null },
  ]) {
    assert.throws(() => parse(policy.createTagSchema, value));
  }
  for (const value of [
    { expectedVersion: 1, reason: "Edit" },
    { label: null, expectedVersion: 1, reason: "Edit" },
    { status: "ARCHIVED", expectedVersion: 1, reason: "Edit" },
    { status: "ACTIVE", expectedVersion: 0, reason: "Edit" },
    { status: "ACTIVE", expectedVersion: 1, reason: " " },
  ])
    assert.throws(() => parse(policy.updateTagSchema, value));
  assert.deepEqual(
    parse(policy.rejectTagRequestSchema, {
      expectedVersion: 1,
      reason: " Invalid tag ",
    }),
    {
      expectedVersion: 1,
      reason: "Invalid tag",
    },
  );
});
