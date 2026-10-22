import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync, randomUUID } from "node:crypto";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SmtpTransactionalMailer } from "../../dist/infrastructure/email/smtp-transactional-mailer.adapter.js";
import { FcmPushSender } from "../../dist/infrastructure/push/fcm-push-sender.adapter.js";
import {
  NotificationDispatcher,
  enabledChannels,
} from "../../dist/modules/notifications/application/services/notification-dispatcher.js";
import { PushTokensUseCases } from "../../dist/modules/notifications/application/use-cases/push-tokens.use-cases.js";
import { PrismaInAppNotificationAdapter } from "../../dist/modules/notifications/infrastructure/channels/prisma-in-app-notification.adapter.js";
import { SkillNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/skill-notification.handler.js";
import { RegisterPushTokenDto } from "../../dist/modules/notifications/presentation/http/notifications.dto.js";
import { createFakeDb, runner } from "./fake-db.mjs";
import { A, B, C, fakeOutboxConsumer, rejectsWith, user } from "./fixtures.mjs";

const config = (values) => ({
  get: (key) => values[key],
  getOrThrow: (key) => {
    if (values[key] === undefined) throw new Error(`missing ${key}`);
    return values[key];
  },
});

function channels({
  enabled = ["IN_APP", "EMAIL", "PUSH"],
  mailer,
  push,
} = {}) {
  const db = createFakeDb();
  for (const [id, emailVerified, accountStatus] of [
    [A, true, "ACTIVE"],
    [B, false, "ACTIVE"],
    [C, true, "LOCKED"],
  ]) {
    db.seed("user", {
      id,
      normalizedEmail: `${id}@example.test`,
      emailVerified,
      accountStatus,
    });
  }
  const sent = { emails: [], pushes: [] };
  const dispatcher = new NotificationDispatcher(
    fakeOutboxConsumer(db),
    new PrismaInAppNotificationAdapter(),
    mailer ?? { send: async (mail) => void sent.emails.push(mail) },
    push ?? {
      configured: true,
      send: async (message) => {
        sent.pushes.push(message);
        return { invalidTokens: [] };
      },
    },
    new Set(enabled),
  );
  return { db, sent, dispatcher };
}

const message = (overrides = {}) => ({
  eventId: randomUUID(),
  type: "learning-path.locked",
  userIds: [A, B],
  title: "Learning path scheduled",
  body: "Your learning path schedule is now locked.",
  payload: { pathId: "path-1" },
  ...overrides,
});

test("SH-113: an event reaches each enabled channel once; a repeat does not spam", async () => {
  const ctx = channels();
  ctx.db.seed("pushDeviceToken", { userId: A, token: "token-a" });
  const event = message();

  await ctx.dispatcher.dispatch(event);
  await ctx.dispatcher.dispatch(event);

  assert.deepEqual(
    ctx.db.rows("notification").map(({ userId, channel }) => [userId, channel]),
    [
      [A, "IN_APP"],
      [B, "IN_APP"],
    ],
  );
  assert.equal(ctx.sent.emails.length, 1);
  assert.equal(ctx.sent.pushes.length, 1);
});

test("SH-113: channels follow the event policy and NOTIFICATION_CHANNELS", async () => {
  const inAppOnly = channels({ enabled: ["IN_APP"] });
  inAppOnly.db.seed("pushDeviceToken", { userId: A, token: "token-a" });
  await inAppOnly.dispatcher.dispatch(message());
  assert.deepEqual([inAppOnly.sent.emails, inAppOnly.sent.pushes], [[], []]);
  assert.equal(inAppOnly.db.rows("notification").length, 2);

  const all = channels();
  all.db.seed("pushDeviceToken", { userId: A, token: "report-token" });
  await all.dispatcher.dispatch(message({ type: "report.session.opened" }));
  assert.equal(all.sent.emails.length, 1);
  assert.equal(all.sent.pushes.length, 1);

  const skill = channels();
  skill.db.seed("pushDeviceToken", { userId: A, token: "skill-token" });
  await skill.dispatcher.dispatch(
    message({ type: "skill.verification.decided", userIds: [A] }),
  );
  assert.equal(skill.sent.emails.length, 1);
  assert.equal(skill.sent.pushes.length, 1);

  const material = channels();
  material.db.seed("pushDeviceToken", { userId: A, token: "material-token" });
  await material.dispatcher.dispatch(
    message({ type: "material.purchased", userIds: [A] }),
  );
  assert.equal(material.sent.emails.length, 1);
  assert.equal(material.sent.pushes.length, 1);

  const unconfigured = { configured: false };
  assert.deepEqual([...enabledChannels(undefined, unconfigured)], ["IN_APP"]);
  assert.deepEqual(
    [...enabledChannels(" IN_APP , EMAIL ", unconfigured)],
    ["IN_APP", "EMAIL"],
  );
  assert.throws(() => enabledChannels("IN_APP,SMS", unconfigured), /Invalid/);
  assert.throws(() => enabledChannels("PUSH", unconfigured), /FCM_PROJECT_ID/);
});

test("SH-111/113: skill events use the shared multi-channel dispatcher", async () => {
  const ctx = channels();
  ctx.db.seed("pushDeviceToken", { userId: A, token: "skill-token" });
  const registered = new Map();
  const handler = new SkillNotificationHandler(
    { register: (type, publisher) => registered.set(type, publisher) },
    {
      notificationSummary: async (verificationId) => ({
        verificationId,
        ownerId: A,
        sharingSkillId: "sharing-skill-1",
      }),
    },
    ctx.dispatcher,
  );
  handler.onModuleInit();
  const eventId = randomUUID();
  await registered.get("skill.verification.decided").publish({
    eventId,
    type: "skill.verification.decided",
    version: 1,
    payload: {
      verificationId: "verification-1",
      ownerId: A,
      sharingSkillId: "sharing-skill-1",
    },
  });

  assert.equal(ctx.db.rows("notification").length, 1);
  assert.equal(ctx.sent.emails.length, 1);
  assert.equal(ctx.sent.emails[0].messageId, `${eventId}.${A}@skillhub`);
  assert.equal(ctx.sent.pushes.length, 1);
});

test("SH-113: a failed channel is retried alone without resending the others", async () => {
  let attempts = 0;
  const emails = [];
  const ctx = channels({
    mailer: {
      send: async (mail) => {
        attempts += 1;
        if (attempts === 1) throw new Error("smtp down");
        emails.push(mail);
      },
    },
  });
  ctx.db.seed("pushDeviceToken", { userId: A, token: "token-a" });
  const event = message();

  await assert.rejects(ctx.dispatcher.dispatch(event), /smtp down/);
  await ctx.dispatcher.dispatch(event);

  assert.equal(ctx.db.rows("notification").length, 2);
  assert.equal(ctx.sent.pushes.length, 1);
  assert.equal(emails.length, 1);
});

test("SH-111: email goes to verified active users only, without private data", async () => {
  const ctx = channels({ enabled: ["EMAIL"] });
  const event = message({ userIds: [A, B, C] });

  await ctx.dispatcher.dispatch(event);

  assert.deepEqual(ctx.sent.emails, [
    {
      to: `${A}@example.test`,
      subject: "SkillHub: Learning path scheduled",
      text: "Your learning path schedule is now locked.\n\nOpen SkillHub to see the details.",
      messageId: `${event.eventId}.${A}@skillhub`,
    },
  ]);

  const mails = [];
  const mailer = new SmtpTransactionalMailer(
    config({
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_FROM: "SkillHub",
      SMTP_USER: "bot@example.test",
    }),
  );
  mailer.transporter = {
    sendMail: async (mail) => void mails.push(mail),
    close() {},
  };
  await mailer.send({
    to: "a@example.test",
    subject: "SkillHub: Learning path scheduled",
    text: "Body",
    messageId: "event.user@skillhub",
  });
  assert.deepEqual(
    [mails[0].from, mails[0].to, mails[0].messageId],
    [
      { name: "SkillHub", address: "bot@example.test" },
      "a@example.test",
      "<event.user@skillhub>",
    ],
  );
});

test("SH-112: a browser token belongs to its latest user, who alone can revoke it", async () => {
  const db = createFakeDb();
  const tokens = new PushTokensUseCases(runner(db), {
    assertAction: async (_tx, principal) => principal,
  });
  const token = "fcm-registration-token-0123456789";

  const first = await tokens.register(user(A), token);
  const second = await tokens.register(user(B), token);

  assert.equal(second.id, first.id);
  const [row] = db.rows("pushDeviceToken");
  assert.deepEqual([row.userId, row.revokedAt], [B, null]);
  await rejectsWith(
    tokens.unregister(user(A), row.id),
    404,
    "PUSH_TOKEN_NOT_FOUND",
  );
  await tokens.unregister(user(B), row.id);
  assert.ok(db.rows("pushDeviceToken")[0].revokedAt instanceof Date);
  await rejectsWith(
    tokens.unregister(user(B), row.id),
    404,
    "PUSH_TOKEN_NOT_FOUND",
  );
  assert.ok(
    (await validate(plainToInstance(RegisterPushTokenDto, { token: "short" })))
      .length > 0,
  );
});

test("SH-112: push goes to active tokens and revokes the ones FCM no longer knows", async () => {
  const pushes = [];
  const ctx = channels({
    enabled: ["PUSH"],
    push: {
      configured: true,
      send: async (input) => {
        pushes.push(input);
        return { invalidTokens: ["token-stale"] };
      },
    },
  });
  ctx.db.seed("pushDeviceToken", { userId: A, token: "token-live" });
  ctx.db.seed("pushDeviceToken", { userId: A, token: "token-stale" });
  ctx.db.seed("pushDeviceToken", {
    userId: B,
    token: "token-old",
    revokedAt: new Date("2026-01-01T00:00:00Z"),
  });

  await ctx.dispatcher.dispatch(message());

  assert.deepEqual(pushes[0].tokens, ["token-live", "token-stale"]);
  assert.deepEqual(pushes[0].data, {
    type: "learning-path.locked",
    pathId: "path-1",
  });
  const revoked = ctx.db
    .rows("pushDeviceToken")
    .filter((row) => row.revokedAt !== null)
    .map(({ token }) => token);
  assert.deepEqual(revoked, ["token-stale", "token-old"]);
});

test("SH-112: FCM sends with a signed service-account grant and flags unregistered tokens", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const sender = new FcmPushSender(
    config({
      FCM_PROJECT_ID: "skillhub-test",
      FCM_CLIENT_EMAIL: "push@skillhub-test.iam.gserviceaccount.com",
      FCM_PRIVATE_KEY: privateKey.replaceAll("\n", String.raw`\n`),
    }),
  );
  const requests = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: "access-1", expires_in: 3600 });
    }
    const { message: sent } = JSON.parse(init.body);
    return new Response("{}", { status: sent.token === "gone" ? 404 : 200 });
  };
  try {
    const input = {
      tokens: ["live", "gone"],
      title: "T",
      body: "B",
      data: { type: "x" },
    };
    const result = await sender.send(input);
    await sender.send({ ...input, tokens: ["live"] });

    assert.deepEqual(result, { invalidTokens: ["gone"] });
    const grants = requests.filter(({ url }) => url.endsWith("/token"));
    assert.equal(grants.length, 1);
    const assertion = new URLSearchParams(grants[0].init.body).get("assertion");
    const [header, claims, signature] = assertion.split(".");
    assert.ok(
      createVerify("RSA-SHA256")
        .update(`${header}.${claims}`)
        .verify(publicKey, signature, "base64url"),
    );
    const decoded = JSON.parse(Buffer.from(claims, "base64url").toString());
    assert.deepEqual(
      [decoded.iss, decoded.scope, decoded.aud],
      [
        "push@skillhub-test.iam.gserviceaccount.com",
        "https://www.googleapis.com/auth/firebase.messaging",
        "https://oauth2.googleapis.com/token",
      ],
    );
    const send = requests.find(({ url }) => url.includes("messages:send"));
    assert.equal(
      send.url,
      "https://fcm.googleapis.com/v1/projects/skillhub-test/messages:send",
    );
    assert.equal(send.init.headers.authorization, "Bearer access-1");
  } finally {
    globalThis.fetch = realFetch;
  }

  const unconfigured = new FcmPushSender(config({}));
  assert.equal(unconfigured.configured, false);
  await rejectsWith(
    unconfigured.send({ tokens: ["x"], title: "T", body: "B", data: {} }),
    503,
    "PUSH_NOT_CONFIGURED",
  );
});
