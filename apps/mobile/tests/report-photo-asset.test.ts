import assert from "node:assert/strict";
import { test } from "node:test";
import {
  photoUploadAsset,
  FileSelectionError,
} from "../src/lib/http/picked-image";
import { uploadBody } from "../src/lib/http/file-upload";
import type { ImagePickerAsset } from "expo-image-picker";

const photo: ImagePickerAsset = {
  uri: "file:///cache/photo.jpg",
  width: 100,
  height: 100,
  mimeType: "image/jpeg",
  fileSize: 1234,
};

test("native library photos keep their URI and size and get a safe upload filename", () => {
  const asset = photoUploadAsset(photo);
  assert.equal(asset.name, "bang-chung.jpg");
  assert.equal(asset.uri, photo.uri);
  assert.equal(asset.size, 1234);
  assert.equal(asset.mimeType, "image/jpeg");
  const converted = photoUploadAsset({
    ...photo,
    fileName: "photo.HEIC",
    mimeType: "image/jpg",
  });
  assert.equal(converted.name, "photo.jpg");
  assert.equal(converted.mimeType, "image/jpeg");
});

test("web photos send the actual File bytes, MIME and size through the existing multipart field", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "proof.png", {
    type: "image/png",
    lastModified: 123,
  });
  const asset = photoUploadAsset({
    ...photo,
    file,
    fileName: file.name,
    mimeType: "image/heic",
    fileSize: 9999,
  });
  assert.equal(asset.size, file.size);
  assert.equal(asset.mimeType, "image/png");
  assert.equal(asset.lastModified, 123);
  const body = uploadBody(asset);
  const uploaded = body.get("file");
  assert.ok(uploaded instanceof File);
  assert.equal(uploaded.name, "proof.png");
  assert.deepEqual(
    new Uint8Array(await uploaded.arrayBuffer()),
    new Uint8Array([1, 2, 3]),
  );
});

test("library metadata can fall back to the URI; unsupported formats and empty URIs are rejected", () => {
  assert.equal(
    photoUploadAsset({
      ...photo,
      uri: "content://photos/proof.webp?test=1",
      mimeType: undefined,
    }).mimeType,
    "image/webp",
  );
  assert.equal(
    photoUploadAsset({
      ...photo,
      uri: "content://photos/123",
      mimeType: undefined,
      fileName: "proof.PNG",
    }).name,
    "proof.PNG",
  );
  for (const mimeType of ["image/heic", "image/svg+xml", "video/mp4"])
    assert.throws(
      () => photoUploadAsset({ ...photo, mimeType }),
      FileSelectionError,
    );
  assert.throws(
    () => photoUploadAsset({ ...photo, uri: "" }),
    FileSelectionError,
  );
});
