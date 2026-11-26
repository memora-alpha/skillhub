import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
import { ChatDownloadTicketService } from "../../dist/modules/conversations/application/services/chat-download-ticket.service.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { FileStorageService } from "../../dist/infrastructure/storage/file-storage.service.js";
import { prepareChatImage } from "../../dist/infrastructure/storage/chat-image.js";
import sharp from "sharp";
import { FileContentModeration } from "../../dist/infrastructure/storage/file-content-moderation.js";

const base = {
  id: "file",
  purpose: "CHAT",
  uploadedBy: "sender",
  generation: 1,
  state: "QUARANTINED",
  sha256: "checksum",
  detectedMime: "image/jpeg",
  sizeBytes: 50,
  originalName: "test.jpg",
  objectKey: "private/file",
  resourceType: "CHAT_MESSAGE",
  resourceId: "message",
};
const approved = {
  sourceVersion: "1",
  digest: base.sha256,
  outcome: "ALLOW",
  enforced: true,
  policyVersion: "skillhub-content-v2",
  profanityVersion: 1,
  extractorRevision: 2,
};

test("publishes the attachment card before scanning, but blocks reads until clean and after revocation", async () => {
  let row = base;
  const tx = {
    $queryRaw: async () => {},
    storedFile: { findUnique: async () => row },
  };
  const service = new FileAttachmentService(tx, undefined, {
    get: () => "https://api.example.com",
  });
  const manifest = await service.chatManifest(
    tx,
    "sender",
    ["file"],
    "message",
  );
  assert.equal(manifest[0].fileId, "file");
  assert.deepEqual(await service.chatStatus("sender", "file"), {
    fileId: "file",
    generation: 1,
    state: "READY",
    availability: "PENDING_SCAN",
    accessStatus: "PENDING_SCAN",
    moderationStatus: "PENDING",
    canAttach: true,
    mimeType: "image/jpeg",
    fileSizeBytes: 50,
    attachmentType: "IMAGE",
    width: null,
    height: null,
  });
  const read = () =>
    service.assertBoundReady(tx, "file", {
      type: "CHAT_MESSAGE",
      id: "message",
    });
  await assert.rejects(read(), { message: "FILE_NOT_READY" });
  row = { ...base, state: "READY", scanVerdict: "CLEAN" };
  await assert.rejects(read(), { message: "FILE_NOT_READY" });
  for (const assessment of [
    { ...approved, enforced: false },
    { ...approved, sourceVersion: "2" },
    { ...approved, policyVersion: "obsolete" },
    { ...approved, outcome: "REVIEW" },
    { ...approved, outcome: "FAILED" },
  ]) {
    row = { ...row, moderationAssessment: assessment };
    await assert.rejects(read(), { message: "FILE_NOT_READY" });
  }
  row = { ...row, moderationAssessment: approved };
  assert.equal((await read()).id, "file");
  row = {
    ...row,
    moderationAssessment: {
      sourceVersion: "1",
      digest: "checksum",
      outcome: "BLOCK",
    },
  };
  await assert.rejects(read(), { message: "CONTENT_MODERATION_BLOCKED" });
  await assert.rejects(
    service.chatManifest(tx, "sender", ["file"], "message"),
    {
      message: "CONTENT_MODERATION_BLOCKED",
    },
  );
});

test("a previously issued download ticket still checks live file access after revocation", async () => {
  const principal = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    securityVersion: 1,
  };
  const target = {
    conversationId: randomUUID(),
    messageId: randomUUID(),
    attachmentId: randomUUID(),
  };
  const config = {
    get: () => "https://api.example.com",
    getOrThrow: () => "https://api.example.com",
  };
  const tickets = new ChatDownloadTicketService(config, {
    jwtKey: "fixture-secret",
  });
  const attachment = {
    fileId: base.id,
    attachmentId: target.attachmentId,
    generation: 1,
    checksum: base.sha256,
    fileSizeBytes: base.sizeBytes,
    mimeType: base.detectedMime,
  };
  let row = {
    ...base,
    state: "READY",
    scanVerdict: "CLEAN",
    moderationAssessment: approved,
    resourceId: target.messageId,
  };
  const tx = {
    $queryRaw: async () => {},
    storedFile: { findUnique: async () => row },
  };
  const files = new FileAttachmentService(tx);
  let opens = 0;
  let previews = 0;
  const chat = {
    get: async () => ({
      status: "PUBLISHED",
      conversationId: target.conversationId,
      attachments: [attachment],
    }),
  };
  const storage = {
    readChatImage: async () => {
      previews++;
      return { stream: Readable.from([]), mime: "image/webp", size: 1 };
    },
    readChatContent: async () => {
      opens++;
      return Readable.from([]);
    },
  };
  const conversations = new ConversationsService(
    tx,
    { run: (fn) => fn(tx) },
    {
      require: async (_tx, actor) => {
        assert.equal(actor.userId, principal.userId);
        return { actor };
      },
    },
    null,
    null,
    chat,
    null,
    files,
    storage,
    null,
    null,
    tickets,
  );
  const { url } = await conversations.download(
    principal,
    target.conversationId,
    target.messageId,
    target.attachmentId,
  );
  const ticket = new URL(url).searchParams.get("ticket");
  const access = await tickets.read(ticket, principal);
  await assert.rejects(
    tickets.read(ticket, { ...principal, sessionId: randomUUID() }),
    { status: 404 },
  );
  const download = () =>
    conversations.downloadContent(
      principal,
      access.conversationId,
      access.messageId,
      access.attachmentId,
    );
  (await download()).stream.destroy();
  const preview = () =>
    conversations.downloadContent(
      principal,
      access.conversationId,
      access.messageId,
      access.attachmentId,
      "preview",
    );
  (await preview()).stream.destroy();
  row = {
    ...row,
    moderationAssessment: {
      sourceVersion: "1",
      digest: base.sha256,
      outcome: "BLOCK",
    },
  };
  await assert.rejects(download(), { message: "CONTENT_MODERATION_BLOCKED" });
  await assert.rejects(preview(), { message: "CONTENT_MODERATION_BLOCKED" });
  assert.equal(opens, 1);
  assert.equal(previews, 1);
  await assert.rejects(tickets.read(`invalid${ticket}`, principal), {
    status: 404,
  });
});

test("the generic storage endpoint cannot sign a chat file even after approval", async () => {
  const storage = new FileStorageService(
    {
      find: async () => ({
        ...base,
        state: "READY",
        moderationAssessment: approved,
      }),
    },
    {},
    {},
  );
  await assert.rejects(
    storage.issueDownload(
      {
        actor: { userId: base.uploadedBy },
        fileId: base.id,
        resource: { type: "CHAT_MESSAGE", id: base.resourceId },
      },
      { assertRead: async () => {} },
    ),
    { message: "FILE_NOT_FOUND" },
  );
});

test("private image variants are bounded and strip orientation metadata", async () => {
  const original = await sharp({
    create: { width: 640, height: 400, channels: 3, background: "red" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const stored = new Map();
  const objects = {
    put: async (key, stream, type) => {
      assert.equal(type, "image/webp");
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      stored.set(key, await sharp(Buffer.concat(chunks)).metadata());
    },
  };
  assert.deepEqual(await prepareChatImage(objects, "private/image", original), {
    width: 400,
    height: 640,
  });
  assert.deepEqual([...stored.keys()].sort(), [
    "private/image.chat-image-v1-preview.webp",
    "private/image.chat-image-v1-thumbnail.webp",
  ]);
  for (const [key, image] of stored) {
    assert.equal(image.orientation, undefined);
    assert.equal(image.height, key.includes("thumbnail") ? 320 : 640);
  }
});

test("the final derivative timeout writes a locked terminal verdict", async () => {
  const input = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  const timeout = new AbortController();
  const row = {
    ...base,
    state: "READY",
    scanVerdict: "CLEAN",
    sha256: createHash("sha256").update(input).digest("hex"),
    sizeBytes: input.length,
    moderationAssessment: null,
  };
  const service = new FileContentModeration(
    {
      storedFile: {
        findUnique: async () => row,
        updateMany: async ({ data }) => {
          Object.assign(row, data);
          return { count: 1 };
        },
      },
    },
    {
      read: async () => Readable.from([input]),
      put: async (_key, _body, _mime, signal) => {
        timeout.abort();
        signal.throwIfAborted();
      },
    },
    { mode: () => "enforce" },
    { assess: async (file) => ({ ...approved, digest: file.digest }) },
  );
  await service.process(row.id, row.generation, true, timeout.signal);
  assert.equal(row.moderationAssessment.outcome, "FAILED");
  assert.deepEqual(row.moderationAssessment.reasonCodes, [
    "MEDIA_PROCESSING_TIMEOUT",
  ]);
  assert.equal(row.moderationAssessment.image, undefined);
});
