import assert from "node:assert/strict";
import { test } from "node:test";
import { MaterialThumbnailsService } from "../../dist/modules/materials/application/services/material-thumbnails.service.js";

test("thumbnail projection signs private keys without exposing them", async () => {
  const signed = [];
  const service = new MaterialThumbnailsService({
    signGet: async (key, options) => {
      signed.push({ key, options });
      return `https://cdn.invalid/${key.split("/").at(-1)}`;
    },
  });
  const result = await service.publicProjection("application/pdf", {
    status: "READY",
    smallObjectKey: "private/material/secret-small",
    largeObjectKey: "private/material/secret-large",
  });
  assert.equal(result.kind, "GENERATED");
  assert.equal(signed.length, 2);
  assert.ok(!JSON.stringify(result).includes("private/material"));
  assert.equal(signed[0].options.expiresInSeconds, 300);
});

test("missing or failed thumbnail returns deterministic placeholder", async () => {
  const service = new MaterialThumbnailsService({
    signGet: async () => {
      throw new Error("storage unavailable");
    },
  });
  assert.deepEqual(await service.publicProjection("application/pdf", null), {
    kind: "PLACEHOLDER",
    format: "PDF",
  });
  assert.deepEqual(
    await service.publicProjection(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      {
        status: "READY",
        smallObjectKey: "private/a",
        largeObjectKey: "private/b",
      },
    ),
    { kind: "PLACEHOLDER", format: "DOCX" },
  );
});
