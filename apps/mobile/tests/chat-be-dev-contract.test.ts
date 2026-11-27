import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMessagesApi,
  attachmentSchema,
} from "../src/features/messages/api/messages-api";
import { requireReadyAttachment } from "../src/features/messages/outbox/attachment-errors";
import { attachmentFixture, file, until } from "./fixtures/attachment-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";
import { chatEventReference } from "../src/features/messages/utils/event-reference";

test("attachment stateRevision accepts large sequences and rejects malformed revisions before hydration", () => {
  const frame = (stateRevision: unknown) => ({
    event: "chat.attachment.availability.updated",
    data: JSON.stringify({
      eventId: fixtureId(90),
      version: 1,
      data: {
        conversationId: fixtureId(10),
        messageId: fixtureId(70),
        fileId: fixtureId(40),
        stateRevision,
      },
    }),
  });
  assert.equal(
    chatEventReference(frame("90071992547409930"))?.attachmentsFor,
    fixtureId(10),
  );
  assert.throws(() => chatEventReference(frame(123)), { kind: "protocol" });
});

test("BE dev status and image metadata survive parsing; canAttach gates publication independently of viewing", async () => {
  for (const moderationStatus of [
    "PENDING",
    "APPROVED",
    "BLOCKED",
    "REVIEW_REQUIRED",
    "FAILED",
  ] as const) {
    const canAttach = ["PENDING", "APPROVED"].includes(moderationStatus);
    const status = {
      fileId: fixtureId(40),
      state: "READY",
      generation: 1,
      canAttach,
      moderationStatus,
      accessStatus:
        moderationStatus === "APPROVED" ? "AVAILABLE" : "PENDING_SCAN",
      attachmentType: "IMAGE",
      mimeType: "image/jpeg",
      fileSizeBytes: 100,
      width: 640,
      height: 480,
    };
    const api = createMessagesApi(async () => status, fixtureId(1));
    const parsed = await api.fileStatus(fixtureId(10), fixtureId(40));
    assert.equal(parsed.moderationStatus, moderationStatus);
    assert.equal(parsed.canAttach, canAttach);
    assert.equal(parsed.availability, status.accessStatus);
    if (canAttach) assert.doesNotThrow(() => requireReadyAttachment(parsed));
    else assert.throws(() => requireReadyAttachment(parsed));
  }
  const parsed = attachmentSchema.parse({
    attachmentId: fixtureId(60),
    fileId: fixtureId(40),
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 100,
    downloadUrlEndpoint: "/download",
    contentUrlEndpoint: "/content",
    previewUrlEndpoint: "/preview",
    thumbnailUrlEndpoint: "/thumbnail",
    accessStatus: "REVOKED",
    moderationStatus: "BLOCKED",
    restrictionReason: "REVOKED",
    attachmentType: "IMAGE",
    width: 640,
    height: 480,
  });
  assert.equal(parsed.availability, "REVOKED");
  assert.equal(parsed.restrictionReason, "REVOKED");
  assert.equal(parsed.thumbnailUrlEndpoint, "/thumbnail");
  assert.throws(() =>
    requireReadyAttachment({
      state: "READY",
      canAttach: false,
      moderationStatus: "APPROVED",
    }),
  );
});

test("pending canAttach publishes immediately; a blocked fresh read prevents publication", async () => {
  for (const blocked of [false, true]) {
    const h = attachmentFixture();
    let reads = 0;
    h.files.fileStatus = async () => ({
      fileId: fixtureId(40),
      generation: 1,
      state: "READY",
      canAttach: !blocked || ++reads < 2,
      moderationStatus: blocked && reads >= 2 ? "BLOCKED" : "PENDING",
    });
    try {
      await h.store.start();
      h.store.enqueue(fixtureId(10), "caption", file);
      await until(() => h.row().state === (blocked ? "failed" : "sent"));
      assert.equal(h.sent.length, blocked ? 0 : 1);
    } finally {
      h.store.stop();
    }
  }
});

test("upload recovery reuses a persisted key after a lost response and restart", async () => {
  const h = attachmentFixture();
  const keys: (string | undefined)[] = [];
  let attempts = 0;
  h.files.upload = async (_id, _body, _signal, key) => {
    keys.push(key);
    if (++attempts === 1) throw new AppError("network");
    return { fileId: fixtureId(40), state: "QUARANTINED" };
  };
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "failed");
    const id = h.row().clientMessageId;
    h.store.stop();
    await h.store.start();
    assert.equal(keys.length, 1, "restart cannot upload automatically");
    h.store.retry(id);
    await until(() => h.row().state === "sent");
    assert.deepEqual(keys, [`chat-upload:${id}`, `chat-upload:${id}`]);
    assert.equal(h.sent.length, 1);
  } finally {
    h.store.stop();
  }
});

test("media reads use authenticated client paths rather than ticket URLs, and upload carries its key", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const bytes = new Uint8Array([1, 2, 3]);
  const api = createMessagesApi(async (path, options) => {
    calls.push({ path, options });
    return options?.multipart
      ? { fileId: fixtureId(40), state: "QUARANTINED" }
      : bytes;
  }, fixtureId(1));
  const signal = new AbortController().signal;
  assert.equal(
    await api.content(
      fixtureId(10),
      fixtureId(70),
      fixtureId(60),
      "thumbnail",
      signal,
    ),
    bytes,
  );
  assert.match(calls[0]!.path, /\/thumbnail$/);
  assert.deepEqual(calls[0]!.options, { responseType: "arraybuffer", signal });
  await api.upload(fixtureId(10), new FormData(), signal, "stable-upload-key");
  assert.equal(
    (calls[1]!.options as { idempotencyKey: string }).idempotencyKey,
    "stable-upload-key",
  );
});
