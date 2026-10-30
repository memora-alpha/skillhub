import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import Redis from "ioredis";
import { IdentityThrottle } from "../../dist/shared/auth/identity-throttle.js";
import { EventConnectionsService } from "../../dist/modules/application-events/application/services/event-connections.service.js";

test(
  "real Redis: atomic remaining TTL and shared SSE leases",
  {
    skip: !process.env.TEST_REDIS_URL && "Set TEST_REDIS_URL to isolated Redis",
    timeout: 20000,
  },
  async () => {
    const redis = new Redis(process.env.TEST_REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      connectTimeout: 3000,
    });
    const prefix = `test:backend-limits:${randomUUID()}:`;
    const owned = new Set();
    const adapter = {
      eval: (script, n, ...args) => {
        const keys = args.slice(0, n).map((key) => prefix + key);
        for (const key of keys) owned.add(key);
        return redis.eval(script, n, ...keys, ...args.slice(n));
      },
      zrem: (key, value) => redis.zrem(prefix + key, value),
    };
    try {
      await redis.connect();
      const throttle = new IdentityThrottle(adapter, {
        jwtKey: randomUUID(),
        requestLimit: 1,
        throttleWindowMs: 1500,
      });
      await throttle.request("192.0.2.1", "conversations");
      await assert.rejects(
        throttle.request("192.0.2.1", "conversations"),
        (error) => {
          assert.equal(error.details.dimension, "ip");
          assert(
            error.details.retryAfterSeconds > 0 &&
              error.details.retryAfterSeconds <= 2,
          );
          return true;
        },
      );
      await throttle.request("192.0.2.1", "users");
      for (const key of owned) assert((await redis.pttl(key)) > 0);
      const service = new EventConnectionsService(adapter, {
        values: { user: 1, session: 2, ip: 10, global: 100, retryMs: 3000 },
      });
      const first = await service.acquire("alice", "session-one", "192.0.2.1");
      await assert.rejects(
        service.acquire("alice", "session-two", "192.0.2.1"),
        (error) => {
          assert.equal(error.details.dimension, "user");
          assert(
            error.details.retryAfterSeconds > 0 &&
              error.details.retryAfterSeconds <= 60,
          );
          return true;
        },
      );
      await first.release();
      const next = await service.acquire("alice", "session-two", "192.0.2.1");
      await next.release();
    } finally {
      if (redis.status === "ready" && owned.size) await redis.del(...owned);
      redis.disconnect();
    }
  },
);
