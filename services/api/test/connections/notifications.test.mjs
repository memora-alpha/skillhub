import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConnectionNotificationService } from "../../dist/modules/notifications/application/services/connection-notification.service.js";
import { validateEventPayload } from "../../dist/modules/application-events/domain/event-payload.js";

test("connection notification owner writes generic copy and references only in the supplied transaction", async () => {
  const rows = [],
    owner = new ConnectionNotificationService();
  const tx = {
    notification: {
      create: async ({ data }) => {
        rows.push(data);
        return data;
      },
    },
  };
  const userId = randomUUID(),
    proposalId = randomUUID(),
    conversationId = randomUUID(),
    messageId = randomUUID();
  await owner.create(tx, { userId, type: "proposal.accepted", proposalId });
  await owner.createChat(tx, {
    notificationId: randomUUID(),
    userId,
    conversationId,
    messageId,
  });
  assert.deepEqual(rows[0].payload, { proposalId });
  assert.deepEqual(rows[1].payload, { conversationId, messageId });
  assert(
    rows.every((row) => row.channel === "IN_APP" && row.userId === userId),
  );
  assert.equal(rows[1].body, "A participant sent a message.");
});

test("public feed rejects private content, invalid references, unknown producer/card types and unsafe sequences", () => {
  const notificationId = randomUUID(),
    conversationId = randomUUID(),
    messageId = randomUUID();
  assert.doesNotThrow(() =>
    validateEventPayload("notification.created", { notificationId }),
  );
  assert.doesNotThrow(() =>
    validateEventPayload("chat.message.created", {
      conversationId,
      messageId,
      messageSequence: "9007199254740993",
    }),
  );
  for (const payload of [
    {},
    { notificationId: "invalid" },
    { notificationId, body: "private" },
    { notificationId, storageKey: "private/key" },
  ])
    assert.throws(
      () => validateEventPayload("notification.created", payload),
      /INVALID_PUBLIC_EVENT/,
    );
  for (const messageSequence of [
    "0",
    "-1",
    "abc",
    "1.5",
    "9223372036854775808",
  ])
    assert.throws(
      () =>
        validateEventPayload("chat.message.created", {
          conversationId,
          messageId,
          messageSequence,
        }),
      /INVALID_PUBLIC_EVENT/,
    );
  assert.throws(
    () => validateEventPayload("schedule.confirmed", { conversationId }),
    /INVALID_PUBLIC_EVENT/,
  );
  assert.throws(
    () =>
      validateEventPayload("chat.message.created", {
        conversationId,
        messageId,
        messageSequence: "1",
        objectType: "LEARNING_PATH",
      }),
    /INVALID_PUBLIC_EVENT/,
  );
});
