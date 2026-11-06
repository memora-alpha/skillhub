import assert from "node:assert/strict";
import { test } from "node:test";
import type { RequestOptions } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import { createPathChangesApi } from "../src/features/learning-paths/api/path-changes-api";
import {
  terminationActions,
  canRequestTermination,
} from "../src/features/learning-paths/utils/termination-policy";
import type { ApiLearningPath } from "../src/features/learning-paths/api/learning-paths-contract";
import { notificationTarget } from "../src/features/notifications/utils/notification-target";
import { notificationCopy } from "../src/features/notifications/utils/notification-copy";
import type { InboxNotification } from "../src/features/notifications/api/notifications-api";
import {
  terminationFixture,
  settlementFixture,
} from "./fixtures/path-changes-data";
import { fixtureId } from "./fixtures/learning-requests-data";

const row = terminationFixture();
test("termination reads forward cancellation and settlement signals without mutations", async () => {
  const signal = new AbortController().signal;
  const calls: string[] = [];
  const api = createPathChangesApi(async (url, options) => {
    assert.equal(options?.signal, signal);
    assert.equal(options?.method, undefined);
    calls.push(url);
    return url.endsWith("settlement-status") ? settlementFixture() : [row];
  });
  assert.deepEqual(await api.list(row.pathId, signal), [row]);
  assert.equal(
    (await api.settlement(row.pathId, signal)).status,
    "WAITING_TERMINATION",
  );
  assert.deepEqual(calls, [
    `/learning-paths/${row.pathId}/termination-requests`,
    `/learning-paths/${row.pathId}/settlement-status`,
  ]);
});
test("create repeats the same immutable intent with the caller's idempotency key", async () => {
  const calls: RequestOptions[] = [];
  const api = createPathChangesApi(async (_url, options) => {
    calls.push(options!);
    if (calls.length === 1) throw new AppError("network");
    return row;
  });
  await assert.rejects(api.request(row.pathId, ` ${row.reason} `, "same-key"));
  assert.equal(
    (await api.request(row.pathId, row.reason, "same-key")).id,
    row.id,
  );
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0], {
    method: "POST",
    body: { reason: row.reason },
    idempotencyKey: "same-key",
    replayAfterRenewal: false,
  });
});
test("partner response, withdrawal and escalation use request identity and expected version", async () => {
  const calls: { url: string; options?: RequestOptions }[] = [];
  const api = createPathChangesApi(async (url, options) => {
    calls.push({ url, options });
    return row;
  });
  await api.respond(row.pathId, row.id, 7, false, " Không đồng ý ");
  await api.withdraw(row.pathId, row.id, 7);
  await api.escalate(row.pathId, row.id, 7, " Cần xem xét ");
  assert.deepEqual(
    calls.map((c) => c.options?.body),
    [
      { expectedVersion: 7, accept: false, note: "Không đồng ý" },
      { expectedVersion: 7 },
      { expectedVersion: 7, reason: "Cần xem xét" },
    ],
  );
  assert.deepEqual(
    calls.map((c) => c.url.split("/").at(-1)),
    ["response", "withdraw", "escalate"],
  );
  for (const call of calls) {
    assert.equal(call.options?.replayAfterRenewal, false);
    assert.equal(call.options?.idempotencyKey, undefined);
    assert.ok(call.url.includes(row.id));
  }
});
test("invalid commands fail before transport and do not request Admin execution", async () => {
  let calls = 0;
  const api = createPathChangesApi(async () => {
    calls++;
    return row;
  });
  await assert.rejects(api.request(row.pathId, "a", "key"));
  await assert.rejects(api.request(row.pathId, row.reason, ""));
  await assert.rejects(api.list("invalid"));
  await assert.rejects(async () => api.withdraw(row.pathId, row.id, 0));
  await assert.rejects(async () => api.escalate(row.pathId, row.id, 1, "  "));
  assert.equal(calls, 0);
});
test("cross-path, duplicate, wrong-request and incomplete financial decisions fail closed", async () => {
  for (const payload of [
    [{ ...row, pathId: fixtureId(11) }],
    [row, row],
    [{ ...row, status: "APPLIED" }],
  ]) {
    const api = createPathChangesApi(async () => payload);
    await assert.rejects(api.list(row.pathId), { kind: "protocol" });
  }
  const wrong = createPathChangesApi(async () => ({
    ...row,
    id: fixtureId(31),
  }));
  await assert.rejects(wrong.withdraw(row.pathId, row.id, 1), {
    kind: "protocol",
  });
  const status = createPathChangesApi(async () => ({
    ...settlementFixture(),
    pathId: fixtureId(11),
  }));
  await assert.rejects(status.settlement(row.pathId), { kind: "protocol" });
});
test("decision amounts remain exact strings for both allocations", async () => {
  const resolution = {
    reason: "Quyết định đã duyệt",
    policyReference: "policy-1",
    allocations: [
      {
        allocationId: fixtureId(40),
        refund: "9007199254740993.01",
        counterpartyPayment: "0.09",
        platformFee: "0.00",
      },
      {
        allocationId: fixtureId(41),
        refund: "12.00",
        counterpartyPayment: "1.00",
        platformFee: "2.00",
      },
    ],
  };
  const applied = {
    ...row,
    status: "APPLIED",
    operationId: fixtureId(50),
    resolution,
  };
  const api = createPathChangesApi(async () => [applied]);
  assert.deepEqual((await api.list(row.pathId))[0]?.resolution, resolution);
  const invalid = createPathChangesApi(async () => [
    {
      ...applied,
      resolution: {
        ...resolution,
        allocations: [{ ...resolution.allocations[0], refund: 20 }],
      },
    },
  ]);
  await assert.rejects(invalid.list(row.pathId), { kind: "protocol" });
});
test("actions enforce requester, partner, expiry and terminal status while keeping blocked requests visible", () => {
  const now = Date.parse("2030-01-02T00:00:00Z");
  assert.deepEqual(terminationActions(row, row.requesterId, now), {
    respond: false,
    withdraw: true,
    escalate: true,
  });
  assert.deepEqual(
    terminationActions({ ...row, blockedByDispute: true }, fixtureId(2), now),
    { respond: true, withdraw: false, escalate: false },
  );
  for (const status of ["APPLIED", "WITHDRAWN", "REJECTED", "EXPIRED"] as const)
    assert.deepEqual(
      terminationActions({ ...row, status }, fixtureId(2), now),
      { respond: false, withdraw: false, escalate: false },
    );
  assert.equal(
    terminationActions(row, fixtureId(2), Date.parse(row.expiresAt)).respond,
    false,
  );
  assert.equal(terminationActions(row, undefined, now).escalate, false);
  for (const userId of [row.requesterId, fixtureId(2)])
    assert.equal(
      terminationActions({ ...row, status: "ACCEPTED" }, userId, now).escalate,
      false,
    );
  assert.equal(
    terminationActions({ ...row, status: "STAFF_REVIEW" }, fixtureId(2), now)
      .escalate,
    false,
  );
  const path = {
    status: "ACTIVE",
    lockedVersion: 1,
    settledAt: null,
  } as ApiLearningPath;
  assert.equal(canRequestTermination(path, []), true);
  assert.equal(canRequestTermination(path, [row]), false);
  assert.equal(
    canRequestTermination({ ...path, status: "CANCELLED" }, []),
    false,
  );
  assert.equal(
    canRequestTermination({ ...path, lockedVersion: null }, []),
    false,
  );
  assert.equal(
    canRequestTermination({ ...path, settledAt: row.createdAt }, []),
    false,
  );
});
test("change notifications use Vietnamese templates and validated path navigation only", () => {
  const item: InboxNotification = {
    id: fixtureId(90),
    type: "learning-path.change.updated",
    title: "Learning change updated",
    body: "A cancellation or termination request changed. Open your learning path to review it.",
    payload: {
      pathId: row.pathId,
      changeRequestId: row.id,
      url: "https://untrusted.example.test",
    },
    readAt: null,
    createdAt: row.createdAt,
  };
  assert.deepEqual(notificationTarget(item), {
    pathname: "/paths/[id]/cancel",
    params: { id: row.pathId, changeRequestId: row.id },
  });
  assert.match(notificationCopy(item).title, /hủy/);
  assert.match(notificationCopy(item).body, /Credit/);
  assert.equal(
    notificationTarget({ ...item, payload: { pathId: "javascript:bad" } }),
    undefined,
  );
  assert.equal(notificationTarget({ ...item, payload: null }), undefined);
  assert.equal(
    notificationCopy({ ...item, body: "Lý do riêng của người dùng" }).body,
    "Lý do riêng của người dùng",
  );
});
