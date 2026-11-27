import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import { visibleChatMessage } from "../src/features/messages/utils/chat-visibility";
import { conversationInbox } from "../src/features/messages/utils/conversation-preview";
import { fixtureId } from "./fixtures/learning-requests-data";

const sender = fixtureId(1),
  recipient = fixtureId(2);
const file = {
  attachmentId: fixtureId(50),
  fileId: fixtureId(51),
  filename: "hidden.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 100,
  downloadUrlEndpoint: "/fixture",
  availability: "REVOKED" as const,
};
const message: ApiMessage = {
  id: fixtureId(10),
  conversationId: fixtureId(20),
  senderId: sender,
  messageText: "",
  messageType: "FILE",
  attachments: [file],
  sequence: "1",
  sentAt: "2026-11-25T00:00:00Z",
  readAt: null,
};

test("revoked incoming file metadata is hidden while retaining the message identity and sender error", () => {
  const visible = visibleChatMessage(message, recipient);
  assert.deepEqual(visible.attachments, []);
  assert.equal(visible.id, message.id);
  assert.equal(visible.sequence, message.sequence);
  assert.equal(visibleChatMessage(message, sender), message);
  assert.deepEqual(visibleChatMessage(message, undefined).attachments, []);
  assert.equal(
    message.attachments[0],
    file,
    "visibility never rewrites the authorized snapshot",
  );
});

test("recipient captions and other attachments survive without exposing a revoked filename or changing file semantics", () => {
  const caption = { ...message, messageText: "Caption remains" };
  const visible = visibleChatMessage(caption, recipient)!;
  assert.equal(visible.messageText, "Caption remains");
  assert.equal(visible.messageType, "FILE");
  assert.deepEqual(visible.attachments, []);
  const available = {
    ...file,
    attachmentId: fixtureId(52),
    filename: "visible.pdf",
    availability: "AVAILABLE" as const,
  };
  const pending = {
    ...file,
    attachmentId: fixtureId(53),
    filename: "pending.pdf",
    availability: "PENDING_SCAN" as const,
  };
  const mixed = { ...message, attachments: [file, available, pending] };
  assert.deepEqual(visibleChatMessage(mixed, recipient)?.attachments, [
    available,
    pending,
  ]);
  assert.equal(mixed.attachments.length, 3);
});

test("fresh revocation hides the file without deleting its message, and legacy availability stays intact", () => {
  const available = {
    ...message,
    attachments: [{ ...file, availability: "AVAILABLE" as const }],
  };
  assert.equal(visibleChatMessage(available, recipient).attachments.length, 1);
  const updated = visibleChatMessage(message, recipient);
  assert.equal(updated.id, available.id);
  assert.deepEqual(updated.attachments, []);
  const legacy = {
    ...message,
    attachments: [{ ...file, availability: undefined }],
  };
  assert.equal(visibleChatMessage(legacy, recipient), legacy);
});

test("Inbox previews replace revoked-only files with a recall notice and preserve remaining captions", () => {
  const conversation = {
    id: message.conversationId,
    proposalId: fixtureId(30),
    learningRequestId: null,
    participantAId: sender,
    participantBId: recipient,
    createdAt: message.sentAt,
  };
  const preview = (row: ApiMessage, viewer: string) =>
    conversationInbox(
      [conversation],
      new Map([[conversation.id, row]]),
      [],
      viewer,
    )[0]!;
  assert.equal(preview(message, recipient).preview, "Tệp không còn khả dụng.");
  assert.equal(preview(message, recipient).previewSenderId, sender);
  const image = {
    ...message,
    attachments: [{ ...file, filename: "private.jpg", mimeType: "image/jpeg" }],
  };
  assert.equal(
    visibleChatMessage(image, recipient).attachments.length,
    1,
    "keep an image slot so the revoked image has a placeholder",
  );
  assert.equal(preview(image, recipient).preview, "Ảnh không còn khả dụng.");
  assert.equal(preview(message, sender).preview, "Bạn: Đã gửi một tệp");
  assert.equal(
    preview({ ...message, messageText: "Caption remains" }, recipient).preview,
    "Caption remains",
  );
});
