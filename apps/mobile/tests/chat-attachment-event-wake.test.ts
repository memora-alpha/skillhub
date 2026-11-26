import assert from "node:assert/strict";
import { test } from "node:test";
import { attachmentEventWake } from "../src/features/messages/utils/attachment-event-wake";
import {
  attachmentFixture,
  delivered,
  file,
  until,
  flush,
} from "./fixtures/attachment-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";

test("file and availability events wake only their file; malformed references and unrelated events cannot wake a worker", () => {
  const data = JSON.stringify({ version: 1, data: { fileId: fixtureId(40) } });
  for (const event of [
    "chat.attachment.updated",
    "chat.attachment.availability.updated",
  ])
    assert.deepEqual(attachmentEventWake({ event, data }), {
      fileId: fixtureId(40),
    });
  assert.deepEqual(
    attachmentEventWake({ event: "stream.ready", data: "{}" }),
    {},
  );
  assert.equal(
    attachmentEventWake({ event: "chat.read.updated", data }),
    undefined,
  );
  assert.equal(
    attachmentEventWake({
      event: "chat.attachment.availability.updated",
      data: "invalid",
    }),
    undefined,
  );
  assert.equal(
    attachmentEventWake({
      event: "chat.attachment.availability.updated",
      data: JSON.stringify({ version: 1, data: { fileId: "not-a-uuid" } }),
    }),
    undefined,
  );
});

test("availability event confirms delivery immediately instead of waiting for the two-second poll, without replaying POST", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const h = attachmentFixture();
  let posts = 0;
  h.api.send = async (_id, body) => {
    posts++;
    return {
      deliveryStatus: "PENDING",
      messageId: fixtureId(70),
      clientMessageId: body.clientMessageId,
      statusUrl: "/fixture",
      failureCode: null,
    };
  };
  h.api.delivery = async () => delivered;
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "processing");
    await flush();
    const event = attachmentEventWake({
      event: "chat.attachment.availability.updated",
      data: JSON.stringify({ version: 1, data: { fileId: fixtureId(40) } }),
    });
    h.store.refresh(event!.fileId);
    await until(() => h.row().state === "sent");
    assert.equal(posts, 1);
  } finally {
    h.store.stop();
  }
});
