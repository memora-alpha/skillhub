import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceCompressor,
  keepOriginalEvidence,
} from "../src/features/skills/utils/compress-evidence";
import { evidenceDraft } from "../src/features/skills/utils/evidence-draft";

const image = (size: number) =>
  evidenceDraft(
    {
      uri: "file:///proof.png",
      name: "proof.png",
      size,
      mimeType: "image/png",
    },
    "local",
  );
const encoded = (size: number) => ({
  uri: "file:///optimized.jpg",
  name: "proof.jpg",
  size,
  mimeType: "image/jpeg",
});
test("large images use a smaller JPEG with consistent MIME/name/bytes metadata and retain the original", async () => {
  const file = image(3_000_000);
  const compress = createEvidenceCompressor(async () => encoded(800_000));
  const result = await compress(file);
  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.asset.name, "proof.jpg");
  assert.equal(result.size, 800_000);
  assert.equal(result.originalAsset, file.asset);
  assert.equal(result.originalSize, file.size);
  assert.equal(await compress(result), result);
  const original = keepOriginalEvidence(result, true);
  assert.equal(original.asset, file.asset);
  assert.equal(original.size, 3_000_000);
  assert.equal(await compress(original), original);
});
test("small images, documents, already-uploaded files and original opt-outs never invoke the encoder", async () => {
  let calls = 0;
  const compress = createEvidenceCompressor(async () => {
    calls++;
    return encoded(10);
  });
  const files = [
    image(2_000_000),
    { ...image(3_000_000), fileId: "uploaded" },
    { ...image(3_000_000), keepOriginal: true },
    evidenceDraft(
      { uri: "file:///proof.pdf", name: "proof.pdf", size: 3_000_000 },
      "doc",
    ),
  ];
  for (const file of files) assert.equal(await compress(file), file);
  assert.equal(calls, 0);
});
test("bigger, malformed or failed encodings retain the valid original and do not repeatedly process it", async () => {
  const file = image(3_000_000);
  for (const encode of [
    async () => encoded(4_000_000),
    async () => encoded(0),
    async () => {
      throw new Error("encode unavailable");
    },
  ]) {
    let calls = 0;
    const compress = createEvidenceCompressor(() => {
      calls++;
      return encode();
    });
    const result = await compress(file);
    assert.equal(result.asset, file.asset);
    assert.equal(result.size, file.size);
    assert.equal(result.compressionChecked, true);
    assert.equal(await compress(result), result);
    assert.equal(calls, 1);
  }
});
