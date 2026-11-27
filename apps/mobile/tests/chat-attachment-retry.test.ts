import assert from "node:assert/strict";
import { test } from "node:test";
import { createMessagesApi } from "../src/features/messages/api/messages-api";
import { retryChatAttachment } from "../src/features/messages/utils/retry-chat-attachment";
import { AppError } from "../src/lib/http/errors";
import { fixtureId } from "./fixtures/learning-requests-data";
import {
  attachmentFixture,
  file,
  until,
  flush,
  deferred,
} from "./fixtures/attachment-outbox";

const failed = {
  fileId: fixtureId(40),
  state: "SCAN_FAILED",
  generation: 1,
  moderationStatus: "FAILED" as const,
  accessStatus: "UNAVAILABLE" as const,
  canRetry: true,
};
const pending = {
  ...failed,
  state: "QUARANTINED",
  moderationStatus: "PENDING" as const,
  accessStatus: "PENDING_SCAN" as const,
  canRetry: false,
};

test("chat retry uses the existing file, disables renewal replay and validates its acknowledgement", async () => {
  const signal = new AbortController().signal;
  const calls: unknown[] = [];
  const api = createMessagesApi(async (path, options) => {
    calls.push([path, options]);
    return pending;
  }, fixtureId(1));
  const result = await api.retryAttachment(
    fixtureId(10),
    failed.fileId,
    signal,
  );
  assert.equal(result.canRetry, false);
  assert.equal(result.availability, "PENDING_SCAN");
  assert.deepEqual(calls, [
    [
      `/conversations/${fixtureId(10)}/attachments/${failed.fileId}/retry`,
      {
        method: "POST",
        replayAfterRenewal: false,
        signal,
      },
    ],
  ]);
  for (const row of [
    { ...pending, fileId: fixtureId(41) },
    { ...pending, canRetry: "true" },
  ]) {
    await assert.rejects(
      createMessagesApi(async () => row, fixtureId(1)).retryAttachment(
        fixtureId(10),
        failed.fileId,
      ),
      { kind: "protocol" },
    );
  }
  await assert.rejects(api.retryAttachment("invalid", failed.fileId), {
    kind: "protocol",
  });
  assert.equal(calls.length, 1);
});

test("published status uses message and attachment identity and requires the explicit retry capability", async () => {
  const signal = new AbortController().signal;
  const row = {
    moderationStatus: "FAILED",
    accessStatus: "UNAVAILABLE",
    canRetry: true,
  };
  const api = createMessagesApi(async (path, options) => {
    assert.equal(
      path,
      `/conversations/${fixtureId(10)}/messages/${fixtureId(70)}/attachments/${fixtureId(60)}/status`,
    );
    assert.equal(options?.signal, signal);
    return row;
  }, fixtureId(1));
  assert.deepEqual(
    await api.publishedAttachmentStatus(
      fixtureId(10),
      fixtureId(70),
      fixtureId(60),
      signal,
    ),
    row,
  );
  for (const invalid of [
    { ...row, canRetry: undefined },
    { ...row, accessStatus: "READY" },
    { ...row, moderationStatus: "ALLOW" },
  ]) {
    await assert.rejects(
      createMessagesApi(
        async () => invalid,
        fixtureId(1),
      ).publishedAttachmentStatus(fixtureId(10), fixtureId(70), fixtureId(60)),
      { kind: "protocol" },
    );
  }
});

test("only a fresh technical-failure capability permits requeue; revoked, reviewed and pending files remain closed", async () => {
  let posts = 0;
  for (const status of [
    { ...failed, canRetry: false },
    { ...failed, canRetry: undefined },
    pending,
    {
      ...failed,
      moderationStatus: "BLOCKED" as const,
      accessStatus: "REVOKED" as const,
    },
    { ...failed, accessStatus: "REVOKED" as const },
    {
      ...failed,
      moderationStatus: "REVIEW_REQUIRED" as const,
      accessStatus: "PENDING_SCAN" as const,
    },
  ]) {
    assert.equal(
      await retryChatAttachment({
        read: async () => status,
        retry: async () => {
          posts++;
          return pending;
        },
        current: () => true,
      }),
      status,
    );
  }
  assert.equal(posts, 0);
  let current = true;
  await assert.rejects(
    retryChatAttachment({
      read: async () => {
        current = false;
        return failed;
      },
      retry: async () => {
        posts++;
        return pending;
      },
      current: () => current,
    }),
    { kind: "session" },
  );
  assert.equal(posts, 0);
});

test("an initial technical failure never requeues automatically; a manual retry keeps the upload, caption and message identity", async () => {
  const h = attachmentFixture();
  let retries = 0;
  h.status(failed);
  h.files.retryAttachment = async (conversationId, fileId) => {
    assert.equal(conversationId, fixtureId(10));
    assert.equal(fileId, failed.fileId);
    retries++;
    h.status({
      ...failed,
      state: "READY",
      moderationStatus: "APPROVED",
      accessStatus: "AVAILABLE",
      canAttach: true,
      canRetry: false,
    });
    return pending;
  };
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "failed");
    assert.equal(h.row().failureCode, "CHAT_ATTACHMENT_RETRYABLE");
    assert.equal(retries, 0);
    h.store.setConnection(false);
    h.store.setConnection(true);
    await flush();
    assert.equal(retries, 0);
    h.store.retry(h.row().clientMessageId);
    h.store.retry(h.row().clientMessageId);
    await until(() => h.row().state === "sent");
    assert.equal(retries, 1);
    assert.equal(h.counts().uploads, 1);
    assert.deepEqual(h.sent, [
      {
        clientMessageId: fixtureId(80),
        messageText: "caption",
        attachmentFileIds: [failed.fileId],
      },
    ]);
  } finally {
    h.store.stop();
  }
});

test("a lost requeue response is reconciled with GET and never creates another scan while pending", async () => {
  const h = attachmentFixture();
  let retries = 0;
  h.status(failed);
  h.files.retryAttachment = async () => {
    retries++;
    h.status(pending);
    throw new AppError("network");
  };
  try {
    await h.store.start();
    h.store.enqueue(fixtureId(10), "caption", file);
    await until(() => h.row().state === "failed");
    h.store.retry(h.row().clientMessageId);
    await until(() => retries === 1 && h.row().state === "failed");
    h.store.retry(h.row().clientMessageId);
    await until(() => h.row().state === "sending");
    await flush();
    assert.equal(retries, 1);
    assert.equal(h.sent.length, 0);
    h.status({
      state: "READY",
      moderationStatus: "APPROVED",
      accessStatus: "AVAILABLE",
      canAttach: true,
      canRetry: false,
    });
    h.store.refresh(failed.fileId);
    await until(() => h.row().state === "sent");
    assert.equal(retries, 1);
    assert.equal(h.counts().uploads, 1);
  } finally {
    h.store.stop();
  }
});

test("legacy saved scan failures can be rechecked, but stale permission and a late owner cannot authorize retry", async () => {
  for (const expire of [false, true]) {
    const h = attachmentFixture();
    let retries = 0;
    h.status({ ...failed, canRetry: undefined });
    h.files.retryAttachment = async () => {
      retries++;
      return pending;
    };
    try {
      await h.store.start();
      h.store.enqueue(fixtureId(10), "caption", file);
      await until(() => h.row().state === "failed");
      assert.equal(h.row().failureCode, "CHAT_FILE_REMOTE_UNAVAILABLE");
      const read = deferred<typeof failed>();
      h.files.fileStatus = () => read.promise;
      h.store.retry(h.row().clientMessageId);
      await until(() => h.row().state === "sending");
      if (expire) h.expire();
      read.resolve({ ...failed, canRetry: false });
      await flush();
      await flush();
      assert.equal(retries, 0);
      assert.equal(h.sent.length, 0);
    } finally {
      h.store.stop();
    }
  }
});
