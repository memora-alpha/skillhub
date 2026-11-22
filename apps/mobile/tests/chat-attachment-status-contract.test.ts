import assert from "node:assert/strict";
import { test } from "node:test";
import { createMessagesApi } from "../src/features/messages/api/messages-api";
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
