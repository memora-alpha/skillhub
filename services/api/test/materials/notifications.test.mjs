import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MaterialNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/material-notification.handler.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup() {
  const types = [];
  const sent = [];
  const handler = new MaterialNotificationHandler(
    { register: (type) => types.push(type) },
    { dispatch: async (message) => sent.push(message) },
  );
  handler.onModuleInit();
  return { handler, types, sent };
}

const event = (type, payload, eventId = randomUUID()) => ({
  eventId,
  type,
  version: 1,
  payload,
  correlationId: randomUUID(),
});

test("registers both material events", () => {
  assert.deepEqual(setup().types, ["material.moderated", "material.purchased"]);
});

test("material.moderated tells the owner the decision", async () => {
  const { handler, sent } = setup();
  const ownerId = randomUUID();
  const materialId = randomUUID();
  for (const action of ["approve", "unhide", "reject", "hide"])
    await handler.publish(
      event("material.moderated", { materialId, ownerId, action }),
    );
  assert.deepEqual(
    sent.map((m) => [m.userIds, m.title]),
    [
      [[ownerId], "Material published"],
      [[ownerId], "Material published"],
      [[ownerId], "Material rejected"],
      [[ownerId], "Material hidden"],
    ],
  );
  assert.deepEqual(sent[0].payload, { materialId });
});

test("material.purchased tells buyer and seller under distinct, stable ids", async () => {
  const { handler, sent } = setup();
  const payload = {
    orderId: randomUUID(),
    materialId: randomUUID(),
    buyerId: randomUUID(),
    sellerId: randomUUID(),
  };
  const eventId = randomUUID();
  await handler.publish(event("material.purchased", payload, eventId));
  await handler.publish(event("material.purchased", payload, eventId));
  assert.deepEqual(
    sent.slice(0, 2).map((m) => [m.userIds, m.title]),
    [
      [[payload.buyerId], "Material purchased"],
      [[payload.sellerId], "Material sold"],
    ],
  );
  assert.equal(sent[0].eventId, eventId);
  assert.notEqual(sent[1].eventId, eventId);
  assert.match(sent[1].eventId, UUID);
  // A redelivery derives the same seller id, so the dispatcher's receipt dedupes it.
  assert.equal(sent[3].eventId, sent[1].eventId);
  assert.deepEqual(sent[1].payload, {
    materialId: payload.materialId,
    orderId: payload.orderId,
  });
});

test("invalid material payloads throw", async () => {
  const { handler, sent } = setup();
  const id = randomUUID();
  for (const bad of [
    event("material.moderated", null),
    event("material.moderated", [id]),
    event("material.moderated", { materialId: id, ownerId: id }),
    event("material.moderated", {
      materialId: id,
      ownerId: id,
      action: "toString",
    }),
    event("material.purchased", { materialId: id, buyerId: id }),
    event("material.unknown", { materialId: id }),
    { ...event("material.moderated", { materialId: id }), version: 0 },
  ])
    await assert.rejects(handler.publish(bad), /INVALID_MATERIAL_EVENT/);
  assert.equal(sent.length, 0);
});
