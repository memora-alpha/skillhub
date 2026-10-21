import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmedFormMessage,
  confirmedMethodMessage,
  readConfirmedForm,
} from "../src/features/learning-paths/utils/confirmed-form";
import { confirmAndShare } from "../src/features/learning-paths/api/confirm-and-share";
import { agreementSubmission } from "../src/features/learning-paths/api/agreement-submission";
import {
  createFormDelivery,
  type FormDelivery,
} from "../src/features/messages/utils/confirmed-form-delivery";
import type { Delivery } from "../src/features/messages/api/messages-api";
import { fixtureId } from "./fixtures/learning-requests-data";

const id = fixtureId(30),
  intent = fixtureId(90);
test("confirmed forms round trip their exact resource/version and keep colons in titles", () => {
  for (const kind of ["method", "plan", "schedule"] as const) {
    const value = {
      kind,
      pathId: id,
      version: 3,
      title: "React: dự án đầu tiên",
      summary: "4 buổi · Thực hành",
      ...(kind !== "method" ? { planId: fixtureId(11) } : {}),
      ...(kind === "schedule" ? { scheduleId: fixtureId(12) } : {}),
    };
    assert.deepEqual(readConfirmedForm(confirmedFormMessage(value)), {
      planId: undefined,
      scheduleId: undefined,
      ...value,
    });
  }
  assert.equal(
    readConfirmedForm(
      confirmedMethodMessage(id, 3, {
        exchangeType: "TWO_WAY",
        totalCreditPerUser: "20.00",
      }),
    )?.title,
    "Trao đổi hai chiều",
  );
});
test("HTML-escaped confirmation links retain the exact plan and schedule version", () => {
  for (const kind of ["plan", "schedule"] as const) {
    const value = {
      kind,
      pathId: "9884e680-5a57-4b29-b57c-b0b162399035",
      planId: "5294bace-d539-47d9-9535-a29a2846aab6",
      ...(kind === "schedule"
        ? { scheduleId: "6e3960a8-bee2-4001-98ef-344a09792384" }
        : {}),
      version: kind === "plan" ? 2 : 1,
      title: "Test &amp; React",
      summary: "4 buổi · Giữ nguyên &amp; trong nội dung",
    };
    const text = confirmedFormMessage(value);
    const urlStart = text.lastIndexOf("skillhub://");
    const escaped =
      text.slice(0, urlStart) + text.slice(urlStart).replaceAll("&", "&amp;");
    assert.deepEqual(readConfirmedForm(escaped), {
      scheduleId: undefined,
      ...value,
    });
    assert.equal(
      readConfirmedForm(
        escaped.replace(`version=${value.version}`, "version=99"),
      ),
      null,
    );
    assert.equal(
      readConfirmedForm(escaped.replace(value.planId, "invalid")),
      null,
    );
  }
});

test("malformed, mismatched and incomplete forms stay ordinary chat text", () => {
  const text = confirmedMethodMessage(id, 3, { exchangeType: "ONE_WAY" });
  for (const invalid of [
    text.replace("version=3", "version=4"),
    text.replace("confirmed/method", "confirmed/plan"),
    text.replace(id, "other"),
    `${text}\nextra`,
    "Mình đã xác nhận lộ trình",
  ])
    assert.equal(readConfirmedForm(invalid), null);
});
test("only successful business confirmation shares its form and exact intent", async () => {
  const calls: unknown[] = [];
  const run = confirmAndShare(
    async () => {
      calls.push("confirm");
      return { version: 4 };
    },
    (result, identity) => {
      calls.push({ result, identity });
    },
    () => true,
  );
  assert.deepEqual(await run(intent), { version: 4 });
  assert.deepEqual(calls, [
    "confirm",
    { result: { version: 4 }, identity: intent },
  ]);
  for (const current of [true, false]) {
    const failing = confirmAndShare(
      async () => {
        if (current) throw Error("failed");
        return 4;
      },
      () => {
        assert.fail("must not share");
      },
      () => current,
    );
    await assert.rejects(failing(intent));
  }
});
test("create/revise shares only after self-confirm, retaining known save on retry", async () => {
  let saves = 0,
    confirms = 0;
  const shared: unknown[] = [];
  const submission = agreementSubmission(
    async () => {
      saves++;
      return { id, version: 4 };
    },
    async () => {
      if (++confirms === 1) throw Error("offline");
    },
    () => true,
    (saved, identity) => {
      shared.push({ saved, identity });
    },
  );
  await assert.rejects(submission.send(intent));
  assert.deepEqual(shared, []);
  await submission.send(intent);
  assert.equal(saves, 1);
  assert.deepEqual(shared, [{ saved: { id, version: 4 }, identity: intent }]);
});

function deliveryHarness() {
  let items: FormDelivery[] = [],
    current = true;
  const sends: unknown[] = [],
    refreshes: string[] = [];
  let send: () => Promise<Delivery> = async () => {
    throw Error("offline");
  };
  let check: () => Promise<Delivery> = async () => pending;
  const queue = createFormDelivery({
    api: {
      send: async (cid, body) => {
        sends.push({ cid, body });
        return send();
      },
      delivery: async () => check(),
    },
    isCurrent: () => current,
    read: () => items,
    write: (next) => {
      items = next;
    },
    refresh: (cid) => {
      refreshes.push(cid);
    },
  });
  return {
    queue,
    sends,
    refreshes,
    get items() {
      return items;
    },
    setSend: (next: typeof send) => {
      send = next;
    },
    setCheck: (next: typeof check) => {
      check = next;
    },
    expire: () => {
      current = false;
    },
  };
}
const pending: Delivery = {
  deliveryStatus: "PENDING",
  messageId: fixtureId(100),
  clientMessageId: intent,
  statusUrl: "/delivery",
  failureCode: null,
};
const delivered: Delivery = {
  deliveryStatus: "DELIVERED",
  message: {
    id: fixtureId(100),
    conversationId: id,
    senderId: fixtureId(1),
    messageText: "form",
    messageType: "TEXT",
    attachments: [],
    sequence: "1",
    sentAt: "2030-01-01T00:00:00Z",
    readAt: null,
  },
};
test("chat send failure preserves business success and retries identical form/id only", async () => {
  const h = deliveryHarness();
  const run = confirmAndShare(
    async () => ({ version: 4 }),
    (_, identity) => {
      void h.queue.publish(id, "form", identity);
    },
    () => true,
  );
  assert.deepEqual(await run(intent), { version: 4 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.items[0]?.state, "failed");
  h.setSend(async () => delivered);
  await h.queue.retry(h.items[0]!);
  assert.deepEqual(h.sends, [
    { cid: id, body: { clientMessageId: intent, messageText: "form" } },
    { cid: id, body: { clientMessageId: intent, messageText: "form" } },
  ]);
  assert.deepEqual(h.items, []);
  assert.deepEqual(h.refreshes, [id]);
});
test("processing delivery is checked without publishing or confirming again", async () => {
  const h = deliveryHarness();
  h.setSend(async () => pending);
  await h.queue.publish(id, "form", intent);
  await h.queue.publish(id, "form", intent);
  assert.equal(h.sends.length, 1);
  assert.equal(h.items[0]?.state, "processing");
  h.setCheck(async () => delivered);
  await h.queue.check(h.items[0]!);
  assert.deepEqual(h.items, []);
  assert.equal(h.sends.length, 1);
});
test("stale status response cannot resurrect a delivered form", async () => {
  const h = deliveryHarness();
  h.setSend(async () => pending);
  await h.queue.publish(id, "form", intent);
  let finish!: (value: Delivery) => void;
  h.setCheck(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const stale = h.queue.check(h.items[0]!);
  h.setSend(async () => delivered);
  await h.queue.retry(h.items[0]!);
  finish(pending);
  await stale;
  assert.deepEqual(h.items, []);
});
test("session expiry during sending prevents queue/cache writes and refresh", async () => {
  const h = deliveryHarness();
  h.setSend(async () => {
    h.expire();
    return delivered;
  });
  await h.queue.publish(id, "form", intent);
  assert.equal(h.items[0]?.state, "sending");
  assert.deepEqual(h.refreshes, []);
});
