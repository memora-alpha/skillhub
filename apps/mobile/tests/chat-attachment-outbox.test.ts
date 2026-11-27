import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentOutbox } from "../src/features/messages/outbox/attachment-outbox";
import { TextOutbox } from "../src/features/messages/outbox/text-outbox";
import { AppError } from "../src/lib/http/errors";
import { chatTimeline } from "../src/features/messages/utils/chat-timeline";
import { fixtureId } from "./fixtures/learning-requests-data";
import {
  attachmentFixture,
  delivered,
  file,
  flush,
  until,
  deferred,
} from "./fixtures/attachment-outbox";

test("owner teardown releases prepared web object URLs while preserving native pending files for manual recovery", async () => {
  for (const web of [false, true]) {
    const h = attachmentFixture();
    const upload = deferred<Awaited<ReturnType<typeof h.files.upload>>>();
    let disposed = 0;
    h.files.upload = () => upload.promise;
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", {
      ...file,
      ...(web
        ? {
            file: new File([new Uint8Array(100)], file.name, {
              type: file.mimeType,
            }),
          }
        : {}),
      cleanup: () => {
        disposed++;
      },
    });
    await flush();
    h.store.stop();
    upload.resolve({ fileId: fixtureId(40), state: "QUARANTINED" });
    await flush();
    assert.equal(disposed, web ? 1 : 0);
    assert.equal(h.sent.length, 0);
  }
});

test("enqueue shows a local file bubble before upload settles and sends only after fresh READY", async () => {
  const h = attachmentFixture(),
    upload = deferred<Awaited<ReturnType<typeof h.files.upload>>>();
  h.files.upload = () => upload.promise;
  try {
    await h.store.start();
    assert.equal(h.store.enqueue(fixtureId(10), " caption ", file), true);
    assert.equal(h.row().state, "queued");
    assert.equal(
      chatTimeline([], h.store.getSnapshot().items)[0]?.kind,
      "queued",
    );
    assert.equal(h.row().attachment?.name, file.name);
    assert.equal(h.row().messageText, "caption");
    await flush();
    assert.equal(h.sent.length, 0);
    h.status({ state: "QUARANTINED", moderationStatus: "PENDING" });
    upload.resolve({ fileId: fixtureId(40), state: "QUARANTINED" });
    await until(() => h.counts().reads === 1);
    assert.equal(h.sent.length, 0);
    h.store.refresh(fixtureId(41));
    await flush();
    assert.equal(
      h.counts().reads,
      1,
      "an event for another file does not wake this job",
    );
    h.status({ state: "READY", moderationStatus: undefined });
    h.store.refresh(fixtureId(40));
    await until(() => h.row().state === "sent");
    assert.equal(
      h.counts().reads,
      3,
      "event wakes status, then a fresh pre-send read still gates POST",
    );
    assert.deepEqual(h.sent, [
      {
        clientMessageId: fixtureId(80),
        messageText: "caption",
        attachmentFileIds: [fixtureId(40)],
      },
    ]);
    const keys = new Map<string, string>();
    assert.equal(
      chatTimeline([], h.store.getSnapshot().items, keys)[0]?.id,
      fixtureId(80),
    );
    h.store.reconcile([fixtureId(70)]);
    assert.equal(h.store.getSnapshot().items.length, 0);
  } finally {
    h.store.stop();
  }
});

test("ordinary text can finish while file moderation remains pending", async () => {
  const h = attachmentFixture();
  h.status({ state: "QUARANTINED", moderationStatus: "PENDING" });
  const text = new TextOutbox({
    ...h.options,
    storage: { read: async () => null, write: async () => {} },
  });
  try {
    await Promise.all([h.store.start(), text.start()]);
    h.store.enqueue(fixtureId(10), "", file);
    await until(() => h.counts().reads === 1);
    text.enqueue(fixtureId(10), "next text");
    await until(() => text.getSnapshot().items[0]?.state === "sent");
    assert.equal(h.sent.length, 1);
    assert.deepEqual(h.sent[0]?.attachmentFileIds, []);
    assert.equal(h.row().state, "sending");
  } finally {
    h.store.stop();
    text.stop();
  }
});

test("a rejected file stays only in the sender outbox and cannot appear for another account", async () => {
  const h = attachmentFixture();
  h.status({ state: "REJECTED" });
  const recipient = new AttachmentOutbox(
    {
      ...h.options,
      ownerId: fixtureId(2),
      // Even an incorrectly supplied sender file must not leak into this account.
      storage: { read: async () => h.raw(), write: async () => {} },
    },
    h.files,
  );
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "failed");
    await flush();
    assert.equal(h.row().failureCode, "CHAT_FILE_REJECTED");
    assert.match(h.row().failure!, /do nội dung không phù hợp/);
    assert.equal(
      h.sent.length,
      0,
      "a rejected attachment cannot publish a message",
    );
    assert.equal(
      h.confirmed.length,
      0,
      "no message is inserted into shared chat history",
    );
    assert.equal(
      chatTimeline([], h.store.getSnapshot().items)[0]?.kind,
      "queued",
    );
    await recipient.start();
    assert.deepEqual(recipient.getSnapshot().items, []);
    assert.deepEqual(chatTimeline([], recipient.getSnapshot().items), []);
    assert.equal(h.row().state, "failed", "the sender keeps the error bubble");
  } finally {
    h.store.stop();
    recipient.stop();
  }
});

test("post-moderation READY publishes a pending-scan card, but never a revoked or unavailable file", async () => {
  for (const availability of [
    "PENDING_SCAN",
    "REVOKED",
    "UNAVAILABLE",
  ] as const) {
    const h = attachmentFixture();
    h.status({ state: "READY", availability });
    try {
      await h.store.start();
      h.store.enqueue(fixtureId(10), "caption", file);
      await until(
        () =>
          h.row().state ===
          (availability === "PENDING_SCAN" ? "sent" : "failed"),
      );
      assert.equal(h.sent.length, availability === "PENDING_SCAN" ? 1 : 0);
      if (availability !== "PENDING_SCAN")
        assert.match(h.row().failureCode!, /^CHAT_FILE_/);
    } finally {
      h.store.stop();
    }
  }
});

test("rejected, reviewed, failed scans and fresh-read regression never publish or retry automatically", async () => {
  for (const [state, moderationStatus] of [
    ["REJECTED", undefined],
    ["QUARANTINED", "REVIEW_REQUIRED"],
    ["SCAN_FAILED", "FAILED"],
    ["DELETED", undefined],
  ] as const) {
    const h = attachmentFixture();
    h.status({ state, moderationStatus });
    try {
      await h.store.start();
      h.store.enqueue(fixtureId(10), "caption", file);
      await until(() => h.row().state === "failed");
      assert.equal(h.sent.length, 0);
      assert.match(h.row().failureCode!, /^CHAT_FILE_/);
      h.store.retry(h.row().clientMessageId);
      await flush();
      assert.equal(h.row().state, "failed");
      assert.equal(h.counts().uploads, 1);
      assert.equal(h.row().messageText, "caption");
      assert.equal(h.row().attachment?.name, file.name);
    } finally {
      h.store.stop();
    }
  }
  const h = attachmentFixture();
  let reads = 0;
  h.files.fileStatus = async () => ({
    fileId: fixtureId(40),
    generation: 1,
    state: ++reads === 1 ? "READY" : "QUARANTINED",
  });
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "", file);
    await until(() => h.row().state === "failed");
    assert.equal(h.sent.length, 0);
    assert.match(h.row().failure!, /chưa sẵn sàng/);
  } finally {
    h.store.stop();
  }
});

test("offline/background interrupts preparation and resume requires a manual retry using the uploaded file", async () => {
  for (const [online, active] of [
    [false, true],
    [true, false],
  ]) {
    const h = attachmentFixture();
    h.status({ state: "QUARANTINED", moderationStatus: "PENDING" });
    try {
      await h.store.start();
      h.store.enqueue(fixtureId(10), "caption", file);
      await until(() => h.counts().reads === 1);
      h.store.setConnection(online!, active!);
      await until(() => h.row().state === "failed");
      await flush();
      h.store.retry(h.row().clientMessageId);
      await flush();
      assert.equal(
        h.row().state,
        "failed",
        "retry while offline/background cannot queue a future replay",
      );
      h.status({ state: "READY", moderationStatus: undefined });
      h.store.setConnection(true, true);
      await flush();
      assert.equal(h.sent.length, 0);
      h.store.retry(h.row().clientMessageId);
      await until(() => h.row().state === "sent");
      assert.equal(h.counts().uploads, 1);
      assert.equal(h.sent[0]?.clientMessageId, fixtureId(80));
    } finally {
      h.store.stop();
    }
  }
});

test("restart preserves caption and uploaded file, never resumes a mutation without retry", async () => {
  const h = attachmentFixture();
  h.status({ state: "QUARANTINED", moderationStatus: "PENDING" });
  const restored = new AttachmentOutbox(h.options, h.files);
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.counts().reads === 1);
    h.store.stop();
    await flush();
    await restored.start();
    restored.setConnection(true);
    await flush();
    assert.equal(restored.getSnapshot().items[0]?.state, "failed");
    assert.equal(
      restored.getSnapshot().items[0]?.attachment?.fileId,
      fixtureId(40),
    );
    assert.equal(h.sent.length, 0);
    h.status({ state: "READY", moderationStatus: undefined });
    restored.retry(fixtureId(80));
    await until(() => restored.getSnapshot().items[0]?.state === "sent");
    assert.equal(h.counts().uploads, 1);
    assert.equal(h.sent[0]?.messageText, "caption");
  } finally {
    h.store.stop();
    restored.stop();
  }
});

test("a late upload acknowledgment after backgrounding retains its ID without posting", async () => {
  const h = attachmentFixture(),
    upload = deferred<Awaited<ReturnType<typeof h.files.upload>>>();
  let uploading = false;
  h.files.upload = () => {
    uploading = true;
    return upload.promise;
  };
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => uploading);
    h.store.setConnection(true, false);
    upload.resolve({ fileId: fixtureId(40), state: "QUARANTINED" });
    await until(() => h.row().attachment?.fileId === fixtureId(40));
    await flush();
    assert.equal(h.row().state, "failed");
    assert.equal(h.sent.length, 0);
    assert.equal(
      JSON.parse(h.raw()!).items[0].attachment.fileId,
      fixtureId(40),
    );
  } finally {
    h.store.stop();
  }
});

test("lost POST response only recovers by explicit same-identity lookup and cannot send a duplicate", async () => {
  const h = attachmentFixture();
  let posts = 0;
  h.api.send = async () => {
    posts++;
    throw new AppError("network");
  };
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "failed");
    assert.equal(h.row().phase, "check");
    assert.equal(h.counts().checks, 0);
    h.store.setConnection(false);
    h.store.setConnection(true);
    await flush();
    assert.equal(posts, 1);
    h.store.retry(fixtureId(80));
    await until(() => h.row().state === "sent");
    assert.equal(posts, 1);
    assert.equal(h.counts().checks, 1);
  } finally {
    h.store.stop();
  }
});

test("manual 404 recovery preserves the command body while 403 cannot replay POST", async () => {
  for (const status of [404, 403]) {
    const h = attachmentFixture();
    h.api.send = async (_id, body) => {
      h.sent.push(body);
      throw new AppError("network");
    };
    try {
      await h.store.start();
      h.store.enqueue(fixtureId(10), "caption", file);
      await until(() => h.row().state === "failed");
      await flush();
      h.api.delivery = async () => {
        throw new AppError("http", status);
      };
      h.api.send = async (_id, body) => {
        h.sent.push(body);
        return delivered;
      };
      h.store.retry(fixtureId(80));
      await until(() => h.row().state === (status === 404 ? "sent" : "failed"));
      assert.equal(h.sent.length, status === 404 ? 2 : 1);
      if (status === 404) assert.deepEqual(h.sent[1], h.sent[0]);
      assert.equal(h.counts().uploads, 1);
    } finally {
      h.store.stop();
    }
  }
});

test("storage failure prevents upload, and a late upload from an expired owner cannot POST", async () => {
  const h = attachmentFixture();
  h.options.storage.write = async () => {
    throw new Error("disk full");
  };
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "failed");
    assert.equal(h.counts().uploads, 0);
    assert.equal(h.sent.length, 0);
  } finally {
    h.store.stop();
  }
  const late = attachmentFixture(),
    upload = deferred<Awaited<ReturnType<typeof late.files.upload>>>();
  late.files.upload = () => upload.promise;
  try {
    await late.store.start();
    late.store.enqueue(fixtureId(10), "caption", file);
    await flush();
    late.expire();
    upload.resolve({ fileId: fixtureId(40), state: "QUARANTINED" });
    await flush();
    assert.equal(late.sent.length, 0);
    assert.equal(late.confirmed.length, 0);
  } finally {
    late.store.stop();
  }
});

test("202 remains local processing until delivery GET confirms it, and pending scan has a bounded wait", async () => {
  const h = attachmentFixture();
  h.api.send = async () => ({
    deliveryStatus: "PENDING",
    messageId: fixtureId(70),
    clientMessageId: fixtureId(80),
    failureCode: null,
    statusUrl: "/fixture",
  });
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "", file);
    await until(() => h.row().state === "processing");
    assert.equal(h.confirmed.length, 0);
    h.store.refresh();
    await until(() => h.row().state === "sent");
    assert.equal(h.confirmed.length, 1);
  } finally {
    h.store.stop();
  }
  const slow = attachmentFixture();
  slow.status({ state: "QUARANTINED", moderationStatus: "PENDING" });
  try {
    await slow.store.start();
    slow.store.enqueue(fixtureId(10), "caption", file);
    await until(() => slow.counts().reads === 1);
    slow.advance(240_000);
    slow.store.refresh();
    await until(() => slow.row().state === "failed");
    assert.equal(slow.sent.length, 0);
    assert.ok(slow.row().attachment?.fileId);
    assert.equal(slow.row().messageText, "caption");
  } finally {
    slow.store.stop();
  }
});
