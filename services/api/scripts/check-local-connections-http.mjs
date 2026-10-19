import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import mongoose, { mongo } from "mongoose";
import Redis from "ioredis";
import { PrismaPg } from "@prisma/adapter-pg";
import { Test } from "@nestjs/testing";
import { Module, ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { PrismaService } from "../dist/infrastructure/database/prisma.service.js";
import { QueueModule } from "../dist/infrastructure/queue/queue.module.js";
import { PrismaUsersRepository } from "../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { IdentityConfig } from "../dist/configs/identity.config.js";
import { redisConnectionOptions } from "../dist/configs/redis.config.js";
import { validateEnvironment } from "../dist/configs/environment.js";
import { setupSwagger } from "../dist/configs/swagger.config.js";
import { ConfigurationRepository } from "../dist/modules/system-configuration/infrastructure/configuration.repository.js";
import { CONFIGURATION_DEFINITIONS } from "../dist/modules/system-configuration/domain/configuration.catalog.js";
import { RedisService } from "../dist/infrastructure/cache/redis.service.js";
import { OBJECT_STORAGE } from "../dist/infrastructure/storage/object-storage.port.js";

process.loadEnvFile();
const originalDatabase = process.env.DATABASE_URL,
  originalMongo = process.env.MONGODB_URI;
const configuredMongo = process.argv.includes("--configured-mongo");
const liveStorage = process.argv.includes("--live-storage");
if (liveStorage && (!configuredMongo || process.env.STORAGE_ENABLED !== "true"))
  throw new Error("LIVE_STORAGE_REQUIRES_CONFIGURED_MONGO_AND_ENABLED_STORAGE");
const mongodPath =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
  process.env.CHECK_MONGOD_PATH;
if (!configuredMongo && !mongodPath)
  throw new Error("CHECK_MONGOD_PATH_REQUIRED");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(originalDatabase).hostname,
  ) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(originalMongo).hostname)
)
  throw new Error("LOCAL_DATABASES_REQUIRED");
const suffix = randomUUID().replaceAll("-", ""),
  schema = `connections_http_${suffix}`,
  prefix = `skillhub-check-${suffix}`;
const client = new pg.Client({
  connectionString: originalDatabase,
  connectionTimeoutMillis: 5000,
});
let app, db, nativeMongo, nativeClient, tempPath, configuredClient, liveObjects;
const passed = [],
  streams = [],
  throttleKeys = new Set();
const record = (label) => {
  passed.push(label);
  console.log(`PASS ${label}`);
};
const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy: () => null,
});
redis.on("error", () => {});
// Unique signing key isolates HTTP/identity rate keys from ordinary development traffic.
process.env.IDENTITY_JWT_KEY = randomBytes(48).toString("base64");
process.env.EVENT_CURSOR_KEY = randomBytes(48).toString("base64");
process.env.LOG_LEVEL = "silent";
const { AppModule } = await import("../dist/app.module.js");
class IsolatedQueueModule {}
Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnectionOptions(process.env.REDIS_URL),
      prefix,
    }),
  ],
  exports: [BullModule],
})(IsolatedQueueModule);
async function boot(uri, enableStorage = false) {
  const values = validateEnvironment({
    ...process.env,
    NODE_ENV: "test",
    MONGODB_URI: uri,
    STORAGE_ENABLED: enableStorage ? "true" : "false",
    EVENT_HEARTBEAT_MS: "1000",
  });
  const testing = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(db)
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(values))
    .overrideModule(QueueModule)
    .useModule(IsolatedQueueModule)
    .compile();
  const commandRedis = testing.get(RedisService),
    evaluate = commandRedis.eval.bind(commandRedis);
  commandRedis.eval = (script, count, ...args) => {
    for (const key of args.slice(0, count))
      if (typeof key === "string" && /^identity:(request|throttle):/.test(key))
        throttleKeys.add(key);
    return evaluate(script, count, ...args);
  };
  const instance = testing.createNestApplication({
    logger: false,
    rawBody: true,
  });
  instance.setGlobalPrefix("api");
  instance.enableVersioning({ type: VersioningType.URI });
  instance.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  setupSwagger(instance);
  await instance.listen(0, "127.0.0.1");
  if (enableStorage) liveObjects = testing.get(OBJECT_STORAGE);
  return instance;
}
let base;
async function call(method, path, token, body, status, key) {
  const expectedStatus = status ?? 200;
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = response.status === 204 ? null : await response.json();
  if (response.status !== expectedStatus)
    throw new Error(
      `HTTP_CHECK_FAILED ${method} ${path.replace(/[a-f0-9-]{36}/gi, ":id")}: ${response.status} expected ${expectedStatus}; ${typeof data?.message === "string" ? data.message : "invalid response"}`,
    );
  return { data: data?.data, response: data, status: response.status };
}
async function openStream(token, last) {
  const abort = new AbortController();
  streams.push(abort);
  const response = await fetch(base + "/api/v1/events", {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(last ? { "Last-Event-ID": last } : {}),
    },
    signal: abort.signal,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const reader = response.body.getReader(),
    frames = [];
  let buffer = "",
    done = false;
  const pump = (async () => {
    try {
      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) {
          done = true;
          break;
        }
        buffer += new TextDecoder().decode(chunk.value);
        let split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          frames.push(frame);
        }
      }
    } catch {
      /* Abort is expected during teardown. */
    }
  })();
  return {
    frames,
    get ended() {
      return done;
    },
    async wait(type) {
      const end = Date.now() + 12000;
      while (Date.now() < end) {
        const frame = frames.find((value) =>
          value.includes(`event: ${type}\n`),
        );
        if (frame) return frame;
        await delay(50);
      }
      throw new Error(`SSE_CHECK_FAILED ${type}`);
    },
    async close() {
      done = true;
      abort.abort();
      await pump;
    },
  };
}
try {
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const name of (await readdir(root))
    .filter((name) => name.startsWith("2026"))
    .sort())
    await client.query(
      await readFile(new URL(`${name}/migration.sql`, root), "utf8"),
    );
  db = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: originalDatabase,
        options: `-c search_path=${schema}`,
      },
      { schema },
    ),
  });
  await db.$connect();
  await new PrismaUsersRepository().seedRoles(db);
  for (const [key, definition] of Object.entries(CONFIGURATION_DEFINITIONS))
    await new ConfigurationRepository(db).insertMissing(
      db,
      key,
      key === "learningRequest.moderationRuleSet"
        ? {
            rules: [
              { category: "TEST", pattern: "isolated-forbidden-pattern" },
            ],
          }
        : definition.defaultValue,
      new Date(0),
    );
  const password = randomBytes(24).toString("base64"),
    identity = new IdentityConfig(new ConfigService(process.env));
  const users = [];
  for (let index = 0; index < 3; index++) {
    const repository = new PrismaUsersRepository();
    const user = await repository.create(db, {
      email: `${suffix}-${index}@connections.test`,
      fullName: "Runtime check participant",
      passwordHash: await identity.crypto.hashPassword(password),
      timezone: "Asia/Ho_Chi_Minh",
      termsVersion: identity.termsVersion,
      reputationScore: 50,
    });
    users.push(await repository.activate(db, user.id));
  }
  const skill = await db.skill.create({
    data: {
      name: `Runtime check ${suffix}`,
      nameKey: `runtime-${suffix}`,
      slug: `runtime-${suffix}`,
      status: "ACTIVE",
    },
  });
  const mongoUrl = new URL(originalMongo);
  mongoUrl.pathname = `/connections_http_${suffix}`;
  configuredClient = new mongo.MongoClient(mongoUrl.toString(), {
    serverSelectionTimeoutMS: 5000,
  });
  await configuredClient.connect();
  const configuredHello = await configuredClient
    .db()
    .admin()
    .command({ hello: 1 });
  if (
    configuredMongo &&
    (!configuredHello.setName || !configuredHello.isWritablePrimary)
  )
    throw new Error("CONFIGURED_MONGO_PRIMARY_REQUIRED");
  app = await boot(mongoUrl.toString());
  base = await app.getUrl();
  await call("GET", "/api/health");
  await call("GET", "/api/health/ready");
  record(
    "AppModule bootstrap and health/ready with local PostgreSQL/Mongo and real Redis",
  );
  const tokens = [];
  for (const user of users)
    tokens.push(
      (
        await call("POST", "/api/v1/auth/login", null, {
          email: user.normalizedEmail,
          password,
        })
      ).data.accessToken,
    );
  record("HTTP login with real password, sessions, grants and JWT");
  await call("GET", "/api/v1/proposals", null, undefined, 401);
  const sharing = (
    await call(
      "POST",
      "/api/v1/me/skills",
      tokens[1],
      {
        skillId: skill.id,
        level: "ADVANCED",
        description: "Teaching description used for isolated runtime checks",
        isVisible: true,
      },
      201,
      randomUUID(),
    )
  ).data;
  const stream = await openStream(tokens[1]);
  const initial = await stream.wait("stream.ready");
  const directBody = {
      sourceType: "DIRECT_SEARCH",
      recipientSharingSkillId: sharing.id,
      message: "I would like to learn this skill",
    },
    directKey = randomUUID();
  const proposal = (
    await call(
      "POST",
      "/api/v1/proposals",
      tokens[0],
      directBody,
      201,
      directKey,
    )
  ).data;
  assert.equal(
    (
      await call(
        "POST",
        "/api/v1/proposals",
        tokens[0],
        directBody,
        200,
        directKey,
      )
    ).data.id,
    proposal.id,
  );
  await call(
    "GET",
    `/api/v1/proposals/${proposal.id}`,
    tokens[2],
    undefined,
    404,
  );
  await call(
    "POST",
    "/api/v1/proposals",
    tokens[0],
    { ...directBody, senderId: users[2].id },
    400,
    randomUUID(),
  );
  const edited = (
    await call(
      "PATCH",
      `/api/v1/proposals/${proposal.id}`,
      tokens[0],
      {
        expectedVersion: 1,
        message: "An updated invitation to learn this skill",
      },
      200,
      randomUUID(),
    )
  ).data;
  assert.equal(edited.expiresAt, proposal.expiresAt);
  const acceptKey = randomUUID();
  const accepted = (
    await call(
      "POST",
      `/api/v1/proposals/${proposal.id}/accept`,
      tokens[1],
      { expectedVersion: 2 },
      200,
      acceptKey,
    )
  ).data;
  const conversation = accepted.conversation;
  assert.equal(
    (
      await call(
        "POST",
        `/api/v1/proposals/${proposal.id}/accept`,
        tokens[1],
        { expectedVersion: 2 },
        200,
        acceptKey,
      )
    ).data.conversation.id,
    conversation.id,
  );
  await call("GET", `/api/v1/conversations/${conversation.id}`, tokens[0]);
  await call("GET", "/api/v1/conversations", tokens[1]);
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}`,
    tokens[2],
    undefined,
    404,
  );
  record(
    "Direct proposal create/update/accept, idempotent replay, validation and nonmember 404",
  );
  await stream.wait("proposal.accepted");
  await stream.wait("notification.created");
  const inbox = (await call("GET", "/api/v1/notifications", tokens[1])).data;
  await call(
    "PATCH",
    `/api/v1/notifications/${inbox[0].id}/read`,
    tokens[1],
    undefined,
    204,
  );
  await stream.wait("notification.read");
  record("Real Redis/PG SSE proposal/notification create/read delivery");
  const resume = /^id: (.+)$/m.exec(initial)[1];
  await stream.close();
  const replay = await openStream(tokens[1], resume);
  await replay.wait("proposal.accepted");
  await replay.close();
  record("Signed SSE Last-Event-ID reconnect/replay");
  await call("GET", "/api/v1/proposals?direction=sent", tokens[0]);
  const learningRequest = (
    await call(
      "POST",
      "/api/v1/learning-requests",
      tokens[0],
      {
        title: "Learning Request for runtime checks",
        skillId: skill.id,
        description:
          "An isolated request description for real owner adapter checks",
        learningGoal: "Learn the selected skill using a valid request",
        currentLevel: "BEGINNER",
      },
      201,
    )
  ).data;
  const published = (
    await call(
      "POST",
      `/api/v1/learning-requests/${learningRequest.id}/publish`,
      tokens[0],
      { expectedVersion: learningRequest.version },
    )
  ).data;
  assert.equal(published.status, "OPEN");
  await call("GET", "/api/v1/learning-requests", tokens[1]);
  const requestBody = {
    sourceType: "LEARNING_REQUEST",
    learningRequestId: learningRequest.id,
    message: "A teaching proposal for this request",
  };
  const rejected = (
    await call(
      "POST",
      "/api/v1/proposals",
      tokens[1],
      requestBody,
      201,
      randomUUID(),
    )
  ).data;
  assert.equal(
    (
      await call(
        "POST",
        `/api/v1/proposals/${rejected.id}/reject`,
        tokens[0],
        { expectedVersion: 1 },
        200,
        randomUUID(),
      )
    ).data.status,
    "REJECTED",
  );
  const withdrawn = (
    await call(
      "POST",
      "/api/v1/proposals",
      tokens[1],
      requestBody,
      201,
      randomUUID(),
    )
  ).data;
  assert.equal(
    (
      await call(
        "POST",
        `/api/v1/proposals/${withdrawn.id}/withdraw`,
        tokens[1],
        { expectedVersion: 1 },
        200,
        randomUUID(),
      )
    ).data.status,
    "WITHDRAWN",
  );
  const requestOffer = (
    await call(
      "POST",
      "/api/v1/proposals",
      tokens[1],
      requestBody,
      201,
      randomUUID(),
    )
  ).data;
  const requestAccepted = (
    await call(
      "POST",
      `/api/v1/proposals/${requestOffer.id}/accept`,
      tokens[0],
      { expectedVersion: 1, expectedRequestVersion: published.version },
      200,
      randomUUID(),
    )
  ).data;
  assert.equal(
    requestAccepted.conversation.learningRequestId,
    learningRequest.id,
  );
  assert.equal(
    (
      await db.learningRequest.findUniqueOrThrow({
        where: { id: learningRequest.id },
      })
    ).status,
    "NEGOTIATING",
  );
  record(
    "Real Learning Request create/publish/browse adapters and request proposal reject/withdraw/accept",
  );
  if (!configuredHello.setName) {
    await call(
      "POST",
      `/api/v1/conversations/${conversation.id}/messages`,
      tokens[0],
      { clientMessageId: randomUUID(), messageText: "Local runtime check" },
      503,
    );
    record("Configured standalone Mongo blocks message send with explicit 503");
  } else {
    record("Configured Mongo service is a writable replica-set PRIMARY");
  }
  const form = new FormData();
  form.append(
    "file",
    new Blob(["%PDF-1.4\nLocal fixture"], { type: "application/pdf" }),
    "check.pdf",
  );
  const upload = await fetch(
    base + `/api/v1/conversations/${conversation.id}/attachments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens[0]}` },
      body: form,
      signal: AbortSignal.timeout(10000),
    },
  );
  assert.equal(upload.status, 503);
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}/attachments/${randomUUID()}/status`,
    tokens[0],
    undefined,
    404,
  );
  record(
    "File upload is unavailable when storage is disabled; unknown file status remains 404",
  );
  await app.close();
  app = undefined;

  let replicaUri = mongoUrl.toString();
  if (!configuredMongo) {
    // Native temporary replica set uses the installed mongod binary, separate port/data path.
    const portProbe = createServer();
    await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
    const port = portProbe.address().port;
    await new Promise((resolve) => portProbe.close(resolve));
    tempPath = await mkdtemp(join(tmpdir(), "skillhub-mongo-check-"));
    nativeMongo = spawn(
      mongodPath,
      [
        "--dbpath",
        tempPath,
        "--port",
        String(port),
        "--bind_ip",
        "127.0.0.1",
        "--replSet",
        "skillhub-check",
        "--logpath",
        join(tempPath, "mongo.log"),
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    const nativeUri = `mongodb://127.0.0.1:${port}/connections_http_${suffix}?directConnection=true`;
    nativeClient = new mongo.MongoClient(nativeUri, {
      serverSelectionTimeoutMS: 1000,
    });
    let connected = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await nativeClient.connect();
        connected = true;
        break;
      } catch {
        await delay(300);
      }
    }
    if (!connected) throw new Error("NATIVE_MONGO_STARTUP_FAILED");
    await nativeClient
      .db()
      .admin()
      .command({
        replSetInitiate: {
          _id: "skillhub-check",
          members: [{ _id: 0, host: `127.0.0.1:${port}` }],
        },
      });
    for (let attempt = 0; attempt < 50; attempt++) {
      if (
        (await nativeClient.db().admin().command({ hello: 1 }))
          .isWritablePrimary
      )
        break;
      await delay(200);
    }
    replicaUri = nativeUri + "&replicaSet=skillhub-check";
  }
  const mongoTest = spawnSync(
    process.execPath,
    ["--test", "test/connections/mongo.integration.test.mjs"],
    { env: { ...process.env, TEST_MONGODB_URI: replicaUri }, encoding: "utf8" },
  );
  console.log(
    (mongoTest.stdout ?? "")
      .split(/\r?\n/)
      .filter((line) => /^# (tests|pass|fail|skipped)|^not ok/.test(line))
      .join("\n"),
  );
  if (mongoTest.status !== 0) throw new Error("REAL_MONGO_SUITE_FAILED");
  record(
    configuredMongo
      ? "Configured Mongo service publication/read integration test"
      : "Native Mongo replica-set publication/read integration test",
  );
  const indexes = spawnSync(process.execPath, ["scripts/migrate-chat.mjs"], {
    env: { ...process.env, MONGODB_URI: replicaUri },
    encoding: "utf8",
  });
  if (indexes.status !== 0) throw new Error("MONGO_INDEX_MIGRATION_FAILED");
  app = await boot(replicaUri, liveStorage);
  base = await app.getUrl();
  const chatStream = await openStream(tokens[1]);
  await chatStream.wait("stream.ready");
  const messageBody = {
    clientMessageId: randomUUID(),
    messageText: "Message for isolated live API check",
  };
  const sent = await call(
    "POST",
    `/api/v1/conversations/${conversation.id}/messages`,
    tokens[0],
    messageBody,
    201,
  );
  const message = sent.data.message;
  assert.equal(sent.data.deliveryStatus, "DELIVERED");
  assert.equal(typeof message.sequence, "string");
  const retry = await call(
    "POST",
    `/api/v1/conversations/${conversation.id}/messages`,
    tokens[0],
    messageBody,
    201,
  );
  assert.equal(retry.data.message.id, message.id);
  await call(
    "POST",
    `/api/v1/conversations/${conversation.id}/messages`,
    tokens[0],
    { ...messageBody, messageText: "Conflicting body" },
    409,
  );
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}/message-deliveries/${messageBody.clientMessageId}`,
    tokens[0],
  );
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}/message-deliveries/${messageBody.clientMessageId}`,
    tokens[1],
    undefined,
    404,
  );
  const history = (
    await call(
      "GET",
      `/api/v1/conversations/${conversation.id}/messages`,
      tokens[1],
    )
  ).data;
  assert.equal(history.length, 1);
  assert.equal(history[0].id, message.id);
  await call(
    "POST",
    `/api/v1/conversations/${conversation.id}/read`,
    tokens[1],
    { messageId: message.id },
  );
  await chatStream.wait("chat.message.created");
  await chatStream.wait("chat.read.updated");
  await chatStream.close();
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}/messages?afterSequence=${message.sequence}`,
    tokens[1],
  );
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}/messages/${message.id}/attachments/${randomUUID()}/download`,
    tokens[1],
    undefined,
    404,
  );
  if (liveStorage) {
    const fileStream = await openStream(tokens[0]);
    await fileStream.wait("stream.ready");
    // A harmless 1x1 PNG; only its random test object is written to the live bucket.
    const fixture = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const liveForm = new FormData();
    liveForm.append(
      "file",
      new Blob([fixture], { type: "image/png" }),
      "check.png",
    );
    const liveUpload = await fetch(
      base + `/api/v1/conversations/${conversation.id}/attachments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens[0]}` },
        body: liveForm,
        signal: AbortSignal.timeout(30000),
      },
    );
    assert.equal(liveUpload.status, 202, "LIVE_UPLOAD_STATUS_FAILED");
    const uploaded = (await liveUpload.json()).data;
    assert.equal(uploaded.state, "QUARANTINED");
    await call(
      "GET",
      `/api/v1/conversations/${conversation.id}/attachments/${uploaded.fileId}/status`,
      tokens[1],
      undefined,
      404,
    );
    let state;
    const deadline = Date.now() + 45000;
    do {
      state = (
        await call(
          "GET",
          `/api/v1/conversations/${conversation.id}/attachments/${uploaded.fileId}/status`,
          tokens[0],
        )
      ).data.state;
      if (state === "READY") break;
      if (["REJECTED", "SCAN_FAILED"].includes(state))
        throw new Error("LIVE_FILE_SCAN_FAILED");
      await delay(250);
    } while (Date.now() < deadline);
    assert.equal(state, "READY", "LIVE_FILE_READY_TIMEOUT");
    assert.equal(
      (
        await db.storedFile.findUniqueOrThrow({
          where: { id: uploaded.fileId },
        })
      ).scanVerdict,
      "CLEAN",
    );
    await fileStream.wait("chat.attachment.updated");
    const fileBody = {
      clientMessageId: randomUUID(),
      attachmentFileIds: [uploaded.fileId],
    };
    const fileSent = (
      await call(
        "POST",
        `/api/v1/conversations/${conversation.id}/messages`,
        tokens[0],
        fileBody,
        201,
      )
    ).data;
    assert.equal(fileSent.deliveryStatus, "DELIVERED");
    const fileMessage = fileSent.message;
    assert.equal(fileMessage.attachments.length, 1);
    assert.equal(
      (
        await call(
          "POST",
          `/api/v1/conversations/${conversation.id}/messages`,
          tokens[0],
          fileBody,
          201,
        )
      ).data.message.id,
      fileMessage.id,
    );
    const downloadPath = `/api/v1/conversations/${conversation.id}/messages/${fileMessage.id}/attachments/${fileMessage.attachments[0].attachmentId}/download`;
    await call("GET", downloadPath, tokens[2], undefined, 404);
    const download = (await call("GET", downloadPath, tokens[1])).data;
    const downloaded = await fetch(download.url, {
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(downloaded.status, 200, "LIVE_DOWNLOAD_STATUS_FAILED");
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), fixture);
    await fileStream.close();
    record(
      "Live R2/ClamAV chat upload, asynchronous READY/CLEAN scan, attachment send/retry, authorized signed download and nonmember 404",
    );
  }
  const revokedStream = await openStream(tokens[1]);
  await revokedStream.wait("stream.ready");
  await call("POST", "/api/v1/auth/logout-all", tokens[1], {}, 204);
  const closedDeadline = Date.now() + 5000;
  while (!revokedStream.ended && Date.now() < closedDeadline) await delay(50);
  assert(
    revokedStream.ended,
    "SSE did not close after real session revocation",
  );
  await call(
    "GET",
    `/api/v1/conversations/${conversation.id}`,
    tokens[1],
    undefined,
    401,
  );
  await revokedStream.close();
  record(
    "SSE closes after real logout-all; revoked JWT cannot read conversation",
  );
  record(
    configuredMongo
      ? "Live text send/retry/conflict/status/history/read and chat SSE on configured Mongo service"
      : "Live text send/retry/conflict/status/history/read and chat SSE on native Mongo replica set",
  );
  assert.equal(await db.session.count(), 0);
  assert.equal(await db.creditTransaction.count(), 0);
  record("Acceptance/chat produce no Session/Credit writes");
  console.log(
    `Local HTTP checks passed: ${passed.length}; configured DB migration/replica-set/storage gates remain separate.`,
  );
} catch (error) {
  console.error(
    error.message?.startsWith("HTTP_CHECK_FAILED") ||
      error.message?.startsWith("SSE_CHECK_FAILED") ||
      error.message?.startsWith("Nest can't resolve dependencies")
      ? error.message
      : `Local HTTP check failed: ${error.code ?? error.name}: ${error.message?.match(/^[A-Z_]+$/)?.[0] ?? "see stage output"}`,
  );
  process.exitCode = 1;
} finally {
  for (const stream of streams) stream.abort();
  await app?.close().catch(() => {});
  // A failed Nest compile can leave a Mongoose connection without an app to close.
  for (const connection of mongoose.connections.filter(
    (value) => value.name === schema,
  ))
    await connection.close().catch(() => {});
  if (liveObjects && db) {
    let cleanupFailed = false;
    // Inspect only this run's isolated schema; never enumerate the live bucket.
    for (const file of await db.storedFile.findMany({
      select: { id: true, objectKey: true },
    })) {
      try {
        if (
          !/^[a-f0-9-]{36}$/i.test(file.id) ||
          file.objectKey !== `private/${file.id}`
        ) {
          cleanupFailed = true;
          console.error("UNEXPECTED_TEST_OBJECT_KEY");
          process.exitCode = 1;
        } else {
          await liveObjects.remove(file.objectKey);
          assert.equal(await liveObjects.head(file.objectKey), null);
        }
      } catch {
        cleanupFailed = true;
        console.error("CHECK_TEST_OBJECT_CLEANUP_FAILED");
        process.exitCode = 1;
      }
    }
    if (!cleanupFailed)
      console.log("Live storage cleanup completed for isolated test objects");
  }
  await db?.$disconnect();
  // This client always targets the random database owned by this run, never skillhub_chat.
  if (configuredClient?.db().databaseName === schema) {
    await configuredClient
      .db()
      .dropDatabase()
      .catch(() => {
        console.error("CHECK_MONGO_CLEANUP_FAILED");
        process.exitCode = 1;
      });
  }
  await configuredClient?.close().catch(() => {});
  await nativeClient
    ?.db()
    .admin()
    .command({ shutdown: 1, force: true })
    .catch(() => {});
  await nativeClient?.close().catch(() => {});
  if (nativeMongo) {
    nativeMongo.kill();
    await delay(500);
  }
  // Only exact schemas/data directory created by this run may be removed.
  if (client._connected) {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}_legacy_v3" CASCADE`);
  }
  await client.end().catch(() => {});
  try {
    await redis.connect();
    if (throttleKeys.size) await redis.del(...throttleKeys);
    let cursor = "0";
    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        `${prefix}:*`,
        "COUNT",
        100,
      );
      cursor = result[0];
      if (result[1].length) await redis.del(...result[1]);
    } while (cursor !== "0");
  } catch {
    console.error("CHECK_REDIS_CLEANUP_FAILED: isolated keys expire by TTL");
    process.exitCode = 1;
  } finally {
    redis.disconnect();
  }
  if (
    tempPath &&
    resolve(tempPath).startsWith(
      resolve(join(tmpdir(), "skillhub-mongo-check-")),
    )
  )
    await rm(tempPath, { recursive: true, force: true, maxRetries: 3 });
}
