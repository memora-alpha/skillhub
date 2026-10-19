import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { EventsController } from "../../dist/modules/application-events/presentation/events.controller.js";
import { encodeCursor } from "../../dist/modules/application-events/domain/event-cursor.js";
import { eventSettings } from "../../dist/modules/application-events/domain/event-config.js";
import { BadRequestException, ConflictException } from "@nestjs/common";
function fixture() {
  const userId = randomUUID(),
    epoch = randomUUID(),
    secret = "x".repeat(32),
    frames = [];
  let wakeup,
    expired = false,
    released = 0,
    rows = [];
  const req = {
    principal: { userId, sessionId: randomUUID() },
    query: {},
    headers: { authorization: "Bearer valid" },
    ip: "127.0.0.1",
  };
  const res = new EventEmitter();
  Object.assign(res, {
    writableLength: 0,
    headersSent: false,
    status() {
      return this;
    },
    set(headers) {
      this.headers = headers;
      return this;
    },
    flushHeaders() {
      this.headersSent = true;
    },
    write(frame) {
      frames.push(frame);
      return true;
    },
    end() {
      this.ended = true;
    },
  });
  const events = {
    authorize: async () => {},
    subscribe(_user, callback) {
      wakeup = callback;
      return () => {
        wakeup = undefined;
      };
    },
    head: async () => ({ epoch, lastSequence: 0n }),
    batch: async (_user, _epoch, after) =>
      rows.filter((row) => row.sequence > after),
    visible: async (_p, row) => row.type !== "hidden",
  };
  const sessions = {
    principal: async () => {
      if (expired) throw new Error("expired");
      return req.principal;
    },
  };
  const leases = {
    acquire: async () => ({
      renew: async () => {},
      release: async () => {
        released++;
      },
    }),
  };
  const config = { values: eventSettings({ secret }) };
  return {
    controller: new EventsController(events, sessions, leases, config),
    req,
    res,
    frames,
    events,
    userId,
    epoch,
    secret,
    get released() {
      return released;
    },
    wake() {
      wakeup?.();
    },
    expire() {
      expired = true;
    },
    set rows(value) {
      rows = value;
    },
  };
}
test("SSE connects before snapshots, emits references and hidden checkpoints, closes on auth loss", async () => {
  const f = fixture();
  await f.controller.stream(f.req, f.res);
  assert.match(f.frames[0], /event: stream.ready/);
  assert.equal(f.res.headers["X-Accel-Buffering"], "no");
  f.rows = [
    {
      sequence: 1n,
      type: "chat.message.created",
      eventId: randomUUID(),
      version: 1,
      occurredAt: new Date(),
      payload: { messageId: randomUUID() },
    },
    { sequence: 2n, type: "hidden", payload: { private: "must not leak" } },
  ];
  f.wake();
  await setImmediate();
  await setImmediate();
  assert.match(f.frames.join(""), /event: chat.message.created/);
  assert.match(f.frames.join(""), /event: stream.checkpoint/);
  assert.doesNotMatch(f.frames.join(""), /must not leak/);
  f.expire();
  f.wake();
  await setImmediate();
  assert.equal(f.res.ended, true);
  assert.equal(f.released, 1);
});
test("cross-user cursor fails before streaming headers and releases its connection lease", async () => {
  const f = fixture();
  f.req.headers["last-event-id"] = encodeCursor(
    { userId: randomUUID(), epoch: f.epoch, sequence: 0n },
    f.secret,
  );
  await assert.rejects(
    f.controller.stream(f.req, f.res),
    /INVALID_EVENT_CURSOR/,
  );
  assert.equal(f.res.headersSent, false);
  assert.equal(f.released, 1);
});
test("oversized backpressure closes stream without unbounded buffering", async () => {
  const f = fixture();
  f.res.writableLength = 256 * 1024;
  await f.controller.stream(f.req, f.res);
  assert.equal(f.res.ended, true);
  assert.equal(f.frames.length, 0);
});

test("future replay cursor fails before headers; replay gap during streaming requests snapshot reset", async () => {
  const future = fixture();
  future.req.headers["last-event-id"] = encodeCursor(
    { userId: future.userId, epoch: future.epoch, sequence: 5n },
    future.secret,
  );
  future.events.batch = async () => {
    throw new BadRequestException("INVALID_EVENT_CURSOR");
  };
  await assert.rejects(
    future.controller.stream(future.req, future.res),
    /INVALID_EVENT_CURSOR/,
  );
  assert.equal(future.res.headersSent, false);
  assert.equal(future.released, 1);
  const gap = fixture();
  await gap.controller.stream(gap.req, gap.res);
  gap.events.batch = async () => {
    throw new ConflictException("EVENT_CURSOR_EXPIRED");
  };
  gap.wake();
  await setImmediate();
  assert.match(gap.frames.join(""), /event: stream.reset-required/);
  assert.equal(gap.res.ended, true);
  assert.equal(gap.released, 1);
});

test("API shutdown closes streams and releases subscriptions and leases once", async () => {
  const f = fixture();
  await f.controller.stream(f.req, f.res);
  f.controller.onModuleDestroy();
  f.controller.onModuleDestroy();
  f.wake();
  await setImmediate();
  assert.equal(f.res.ended, true);
  assert.equal(f.released, 1);
});
