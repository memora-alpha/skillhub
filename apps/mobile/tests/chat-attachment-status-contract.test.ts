import assert from "node:assert/strict";
import { test } from "node:test";
import { createMessagesApi } from "../src/features/messages/api/messages-api";
import { attachmentSchema } from "../src/features/messages/api/message-contracts";
import {
  chatFormats,
  validateChatFile,
} from "../src/features/messages/utils/chat-file";
import { FileSelectionError } from "../src/lib/http/picked-image";
import { fixtureId } from "./fixtures/learning-requests-data";

test("chat status preserves optional moderation metadata and rejects unknown values", async () => {
  const base = { fileId: fixtureId(40), generation: 1, state: "QUARANTINED" };
  for (const moderationStatus of [
    undefined,
    "PENDING",
    "REVIEW_REQUIRED",
    "FAILED",
  ]) {
    const row = { ...base, ...(moderationStatus ? { moderationStatus } : {}) };
    const api = createMessagesApi(async () => row, fixtureId(1));
    assert.deepEqual(await api.fileStatus(fixtureId(10), base.fileId), row);
  }
  for (const moderationStatus of [null, "ALLOW", 1]) {
    const api = createMessagesApi(
      async () => ({ ...base, moderationStatus }),
      fixtureId(1),
    );
    await assert.rejects(api.fileStatus(fixtureId(10), base.fileId), {
      kind: "protocol",
    });
  }
});

test("chat only accepts formats supported by the current media pipeline", () => {
  const supported = ["pdf", "docx", "txt", "jpg", "jpeg", "png", "webp"];
  assert.deepEqual(Object.keys(chatFormats).sort(), [...supported].sort());
  for (const extension of supported)
    assert.doesNotThrow(() =>
      validateChatFile({
        name: `lesson.${extension}`,
        uri: "file:///fixture",
        size: 100,
        mimeType: chatFormats[extension],
      }),
    );
  for (const extension of ["doc", "xls", "xlsx", "ppt", "pptx"])
    assert.throws(
      () =>
        validateChatFile({
          name: `lesson.${extension}`,
          uri: "file:///fixture",
          size: 100,
        }),
      FileSelectionError,
    );
});

test("chat preserves availability on message attachments and upload status while accepting legacy responses", async () => {
  const file = {
    attachmentId: fixtureId(41),
    fileId: fixtureId(40),
    filename: "lesson.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 100,
    downloadUrlEndpoint: "/fixture",
  };
  assert.deepEqual(attachmentSchema.parse(file), file);
  for (const availability of [
    "PENDING_SCAN",
    "AVAILABLE",
    "REVOKED",
    "UNAVAILABLE",
  ]) {
    assert.deepEqual(attachmentSchema.parse({ ...file, availability }), {
      ...file,
      availability,
    });
    const status = {
      fileId: file.fileId,
      state: "READY",
      generation: 1,
      availability,
    };
    const api = createMessagesApi(async () => status, fixtureId(1));
    assert.deepEqual(await api.fileStatus(fixtureId(10), file.fileId), status);
  }
  for (const availability of [null, "READY", 1]) {
    assert.equal(
      attachmentSchema.safeParse({ ...file, availability }).success,
      false,
    );
    const api = createMessagesApi(
      async () => ({
        fileId: file.fileId,
        state: "READY",
        generation: 1,
        availability,
      }),
      fixtureId(1),
    );
    await assert.rejects(api.fileStatus(fixtureId(10), file.fileId), {
      kind: "protocol",
    });
  }
});
