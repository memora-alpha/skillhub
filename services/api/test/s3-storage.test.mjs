import assert from "node:assert/strict";
import test from "node:test";
import { S3Client } from "@aws-sdk/client-s3";
import { S3ObjectStorage } from "../dist/infrastructure/storage/s3-object-storage.adapter.js";

test("S3 adapter signs only short-lived GET with attachment disposition", async () => {
  const client = new S3Client({
    region: "test-region",
    endpoint: "https://objects.example.test",
    forcePathStyle: true,
    credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
  });
  const storage = new S3ObjectStorage(client, "private-bucket");
  const url = new URL(
    await storage.signGet("private/file-id", {
      expiresInSeconds: 120,
      disposition: 'attachment; filename="report.pdf"',
      mime: "application/pdf",
    }),
  );
  assert.equal(url.host, "objects.example.test");
  assert.equal(url.pathname, "/private-bucket/private/file-id");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "120");
  assert.equal(
    url.searchParams.get("response-content-disposition"),
    'attachment; filename="report.pdf"',
  );
  assert.equal(
    url.searchParams.get("response-content-type"),
    "application/pdf",
  );
  assert.equal(url.searchParams.has("x-amz-acl"), false);
  await assert.rejects(
    storage.signGet("private/file-id", {
      expiresInSeconds: 301,
      disposition: "attachment",
      mime: "application/pdf",
    }),
    /FILE_POLICY_UNAVAILABLE/,
  );
  client.destroy();
});
