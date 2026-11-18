import assert from "node:assert/strict";
import { test } from "node:test";
import {
  prepareMaterialUpload,
  materialFileTypes,
} from "../src/features/materials/utils/material-upload";
import { FileSelectionError } from "../src/lib/http/picked-image";
import { uploadBody } from "../src/lib/http/file-upload";
import { AppError } from "../src/lib/http/errors";
import { filePickerError } from "../src/lib/http/file-picker-error";

const docx =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const asset = {
  uri: "file:///cache/DocumentPicker/lesson.docx",
  name: "Bài học.DOCX",
  size: 1200,
  lastModified: 1_700_000_000_000,
};

test("iOS DOCX with generic MIME keeps its local URI and supplies Word multipart metadata", () => {
  const source = { ...asset, mimeType: "application/octet-stream" };
  const prepared = prepareMaterialUpload(source);
  assert.equal(prepared.mimeType, docx);
  assert.equal(prepared.uri, source.uri);
  assert.equal(source.mimeType, "application/octet-stream");
  assert.equal(prepareMaterialUpload(asset).mimeType, docx);
  assert.equal(
    prepareMaterialUpload({ ...asset, mimeType: docx }).mimeType,
    docx,
  );
  assert.equal(materialFileTypes.length, 4);
  assert.equal(materialFileTypes.includes("application/msword"), false);

  const parts: unknown[] = [];
  const original = globalThis.FormData;
  try {
    globalThis.FormData = class {
      append(...args: unknown[]) {
        parts.push(args);
      }
    } as unknown as typeof FormData;
    uploadBody(prepared);
    assert.deepEqual(parts, [
      ["file", { uri: asset.uri, type: docx, name: asset.name }],
    ]);
  } finally {
    globalThis.FormData = original;
  }
});

test("material selection rejects legacy Word and mismatched MIME before upload", () => {
  for (const name of [
    "old.doc",
    "image.png",
    "notes.txt",
    "sheet.xls",
    "macro.docm",
  ])
    assert.throws(
      () => prepareMaterialUpload({ ...asset, name }),
      FileSelectionError,
    );
  assert.throws(
    () => prepareMaterialUpload({ ...asset, mimeType: "application/pdf" }),
    FileSelectionError,
  );
  assert.equal(
    prepareMaterialUpload({
      ...asset,
      name: "lesson.pdf",
      mimeType: "application/pdf",
    }).mimeType,
    "application/pdf",
  );
});

test("web Office multipart preserves bytes and filename while normalizing generic File MIME", async () => {
  for (const type of ["", "application/octet-stream", docx]) {
    const file = new File(
      [new Uint8Array([80, 75, 3, 4, 10, 255])],
      asset.name,
      {
        type,
        lastModified: asset.lastModified,
      },
    );
    const source = { ...asset, file, mimeType: "application/octet-stream" };
    const prepared = prepareMaterialUpload(source);
    const part = uploadBody(prepared).get("file") as File;
    assert.equal(part.type, docx);
    assert.equal(part.name, asset.name);
    assert.deepEqual(await part.arrayBuffer(), await file.arrayBuffer());
    assert.equal(prepared.file?.lastModified, asset.lastModified);
    assert.equal(file.type, type, "the selected File must remain unchanged");
  }
  assert.throws(
    () =>
      prepareMaterialUpload({
        ...asset,
        mimeType: docx,
        file: new File(["wrong"], asset.name, { type: "application/pdf" }),
      }),
    FileSelectionError,
  );
});

test("file feedback distinguishes native reading, storage and format failures without raw details", () => {
  assert.match(
    filePickerError(new Error("private/path/token"), "selection"),
    /iCloud/,
  );
  assert.doesNotMatch(
    filePickerError(new Error("private/path/token"), "upload"),
    /private|token/,
  );
  assert.match(
    filePickerError(
      new AppError("http", 503, "FILE_STORAGE_UNAVAILABLE"),
      "upload",
    ),
    /Kho lưu trữ/,
  );
  assert.match(
    filePickerError(
      new AppError("http", 415, "FILE_FORMAT_UNSUPPORTED"),
      "upload",
      "PDF, DOCX, XLSX hoặc PPTX",
    ),
    /DOCX/,
  );
  assert.match(
    filePickerError(
      new AppError("http", 415, "FILE_FORMAT_MISMATCH"),
      "upload",
    ),
    /Nội dung tệp/,
  );
  assert.match(
    filePickerError(new AppError("http", 413), "upload"),
    /dung lượng/,
  );
  assert.match(filePickerError(new AppError("http", 401), "upload"), /hết hạn/);
  assert.match(
    filePickerError(new AppError("protocol"), "upload"),
    /kết quả tệp không hợp lệ/,
  );
  assert.match(filePickerError(new AppError("network"), "upload"), /kết nối/);
  assert.match(filePickerError(new Error(), "status"), /trạng thái tệp/);
});
