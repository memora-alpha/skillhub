import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
import { ChatDownloadTicketService } from "../../dist/modules/conversations/application/services/chat-download-ticket.service.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";

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
  });
  const read = () =>
    service.assertBoundReady(tx, "file", {
      type: "CHAT_MESSAGE",
      id: "message",
    });
  await assert.rejects(read(), { message: "FILE_NOT_READY" });
  row = { ...base, state: "READY", scanVerdict: "CLEAN" };
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
    resourceId: target.messageId,
  };
  const tx = {
    $queryRaw: async () => {},
    storedFile: { findUnique: async () => row },
  };
  const files = new FileAttachmentService(tx);
  let opens = 0;
  const chat = {
    get: async () => ({
      status: "PUBLISHED",
      conversationId: target.conversationId,
      attachments: [attachment],
    }),
  };
  const storage = {
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
  const access = await tickets.read(ticket);
  const download = () =>
    conversations.downloadContent(
      access.principal,
      target.conversationId,
      target.messageId,
      target.attachmentId,
    );
  (await download()).stream.destroy();
  row = {
    ...row,
    moderationAssessment: {
      sourceVersion: "1",
      digest: base.sha256,
      outcome: "BLOCK",
    },
  };
  await assert.rejects(download(), { message: "CONTENT_MODERATION_BLOCKED" });
  assert.equal(opens, 1);
  await assert.rejects(tickets.read(`invalid${ticket}`), { status: 404 });
});
