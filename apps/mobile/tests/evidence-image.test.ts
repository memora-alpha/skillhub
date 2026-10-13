import assert from "node:assert/strict";
import test from "node:test";
import type { ImagePickerAsset } from "expo-image-picker";
import { evidenceImageAsset } from "../src/features/skills/utils/evidence-image-asset";
import { evidenceDraft } from "../src/features/skills/utils/evidence-draft";

const photo: ImagePickerAsset = {
  uri: "file:///cache/photo.jpg",
  width: 100,
  height: 100,
  fileSize: 1000,
  mimeType: "image/jpeg",
};

test("library photo without filename remains a valid upload and preview draft", () => {
  const draft = evidenceDraft(evidenceImageAsset(photo), "local");
  assert.equal(draft.asset.name, "bang-chung.jpg");
  assert.equal(draft.asset.uri, photo.uri);
  assert.equal(draft.size, 1000);
  assert.equal(draft.mime, "image/jpeg");
});

test("converted photo uses returned MIME even when original filename is HEIC", () => {
  const asset = evidenceImageAsset({ ...photo, fileName: "chung-chi.HEIC" });
  assert.equal(asset.name, "chung-chi.jpg");
  assert.equal(evidenceDraft(asset, "local").mime, "image/jpeg");
});

test("limited library metadata uses URI format and keeps supported filename", () => {
  const asset = evidenceImageAsset({
    ...photo,
    uri: "content://photos/proof.png?token=fixture",
    mimeType: undefined,
    fileName: "chung-chi.png",
  });
  assert.equal(asset.name, "chung-chi.png");
  assert.equal(evidenceDraft(asset, "local").mime, "image/png");
});

test("unsupported library formats and unreadable size cannot become upload drafts", () => {
  assert.throws(
    () => evidenceImageAsset({ ...photo, mimeType: "image/heic" }),
    /JPG, PNG/,
  );
  for (const fileSize of [undefined, 0, 10_000_001])
    assert.throws(() =>
      evidenceDraft(evidenceImageAsset({ ...photo, fileSize }), "local"),
    );
});
