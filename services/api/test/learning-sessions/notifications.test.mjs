import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/session-notification.handler.js";

const session = { teacherId: "t", learnerId: "l" };
function handler() {
  const sent = [];
  const registered = [];
  const instance = new SessionNotificationHandler(
    { register: (type) => registered.push(type) },
    { dispatch: async (message) => sent.push(message) },
    { session: { findUnique: async () => session } },
  );
  instance.onModuleInit();
  return { instance, sent, registered };
}
const event = (type, payload) => ({
  eventId: "e1",
  type,
  version: 1,
  payload: { sessionId: "s", ...payload },
});

test("routes session events to the right participants", async () => {
  const { instance, sent, registered } = handler();
  assert.equal(registered.length, 6);
  await instance.publish(
    event("session.absence-excuse.submitted", { absentUserId: "l" }),
  );
  await instance.publish(
    event("session.absence-excuse.decided", {
      absentUserId: "l",
      status: "ACCEPTED",
    }),
  );
  await instance.publish(event("session.no-show.finalized", {}));
  assert.deepEqual(
    sent.map((m) => m.userIds),
    [["t"], ["l"], ["t", "l"]],
  );
  assert.equal(sent[0].payload.sessionId, "s");
  await assert.rejects(instance.publish(event("session.unknown", {})));
});
