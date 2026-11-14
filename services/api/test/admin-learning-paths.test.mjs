import assert from "node:assert/strict";
import test from "node:test";

const forbiddenProjectionKeys = [
  "accessToken",
  "livekitToken",
  "roomMetadata",
  "messageBody",
  "storageKey",
  "email",
];

test("admin learning path contract excludes private provider and evidence fields", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL(
        "../src/modules/administration/application/services/admin-learning-paths.reader.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const key of forbiddenProjectionKeys)
    assert.equal(new RegExp(`\\b${key}\\b`, "u").test(source), false, key);
});
