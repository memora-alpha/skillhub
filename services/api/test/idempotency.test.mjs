import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalJson,
  fingerprintCommand,
  IdempotencyService,
} from "../dist/infrastructure/idempotency/idempotency.service.js";

test("canonical fingerprints ignore object key insertion order", () => {
  assert.equal(
    canonicalJson({ b: 2, a: { d: 4, c: 3 } }),
    canonicalJson({ a: { c: 3, d: 4 }, b: 2 }),
  );
  assert.equal(
    fingerprintCommand({ b: 2, a: 1 }),
    fingerprintCommand({ a: 1, b: 2 }),
  );
});

test("same identity replays a reference and changed command conflicts", async () => {
  const records = new Map();
  let count = 0;
  const tx = {
    $executeRaw: async () =>
      records.has("present")
        ? 0
        : (records.set("present", true),
          records.set("record", { fingerprint: records.get("fingerprint") }),
          1),
    idempotencyRecord: {
      findUnique: async () => records.get("record"),
      update: async ({ data }) => {
        records.set("record", {
          ...data,
          fingerprint: records.get("fingerprint"),
        });
      },
    },
  };
  const runner = { run: async (work) => work(tx) };
  const service = new IdempotencyService(runner);
  const input = {
    scope: "actor:1",
    operation: "test:v1",
    key: "abc",
    command: { a: 1 },
  };
  records.set("fingerprint", fingerprintCommand(input.command));
  const first = await service.execute(
    input,
    async () => (count++, { id: "one", status: "CREATED" }),
  );
  const replay = await service.execute(
    input,
    async () => (count++, { id: "two", status: "CREATED" }),
  );
  assert.deepEqual(first, {
    value: { id: "one", status: "CREATED" },
    replayed: false,
  });
  assert.deepEqual(replay, { value: first.value, replayed: true });
  assert.equal(count, 1);
  await assert.rejects(
    service.execute({ ...input, command: { a: 2 } }, async () => ({
      id: "two",
      status: "CREATED",
    })),
    (error) => error.getStatus?.() === 409,
  );
  await assert.rejects(
    service.execute({ ...input, key: "bad\nkey" }, async () => ({
      id: "two",
      status: "CREATED",
    })),
    (error) => error.getStatus?.() === 400,
  );
});
