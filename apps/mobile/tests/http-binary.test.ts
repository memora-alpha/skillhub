import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { createHttpClient } from "../src/lib/http/client";

test("binary GET renews auth on 401, preserves moderation errors, and refuses late old-session bytes", async () => {
  let token = "old",
    generation = 1,
    calls = 0,
    status = 200,
    changeOwner = false;
  const headers: unknown[] = [];
  const http = axios.create({
    adapter: async (config) => {
      headers.push(config.headers.get("Authorization"));
      calls++;
      const code = calls === 1 ? 401 : status;
      if (changeOwner) generation++;
      return {
        config,
        status: code,
        statusText: "",
        headers: {},
        data:
          code === 200
            ? new Uint8Array([1, 2, 3]).buffer
            : new TextEncoder().encode(
                JSON.stringify({
                  success: false,
                  message: code === 401 ? "INVALID_TOKEN" : "FILE_NOT_READY",
                }),
              ).buffer,
      };
    },
  });
  const client = createHttpClient(() => "https://fixture.test/api/v1", http);
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: async () => token,
    renew: async () => {
      token = "new";
    },
    expire: async () => {},
  });
  const read = () =>
    client.request("/conversations/image/thumbnail", {
      authenticated: true,
      responseType: "arraybuffer",
    });
  assert.deepEqual(await read(), new Uint8Array([1, 2, 3]));
  assert.deepEqual(headers, ["Bearer old", "Bearer new"]);
  status = 409;
  await assert.rejects(read(), { code: "FILE_NOT_READY", status: 409 });
  status = 200;
  changeOwner = true;
  await assert.rejects(read(), { kind: "session" });
});

test("multipart upload passes the idempotency key without replaying bytes after token renewal", async () => {
  let calls = 0,
    renewed = false;
  const http = axios.create({
    adapter: async (config) => {
      calls++;
      assert.equal(config.headers.get("Idempotency-Key"), "upload-key");
      return {
        config,
        status: 401,
        statusText: "",
        headers: {},
        data: { success: false, message: "INVALID_TOKEN" },
      };
    },
  });
  const client = createHttpClient(() => "https://fixture.test/api/v1", http);
  client.bindSession({
    generation: 1,
    getToken: async () => "fixture",
    renew: async () => {
      renewed = true;
    },
    expire: async () => {},
  });
  await assert.rejects(
    client.request("/attachments", {
      method: "POST",
      body: new FormData(),
      multipart: true,
      authenticated: true,
      idempotencyKey: "upload-key",
      replayAfterRenewal: false,
    }),
    { status: 401 },
  );
  assert.equal(renewed, true);
  assert.equal(calls, 1);
});
