import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  ValidationPipe,
  VersioningType,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IdentityCrypto } from "../../dist/modules/auth/domain/identity-crypto.js";
import { RegisterUseCase } from "../../dist/modules/auth/application/use-cases/register.use-case.js";
import { ReauthProofService } from "../../dist/modules/auth/application/services/reauth-proof.service.js";
import { CreateStaffUseCase } from "../../dist/modules/users/application/use-cases/create-staff.use-case.js";
import { AuthController } from "../../dist/modules/auth/presentation/http/auth.controller.js";
import { AdministrationController } from "../../dist/modules/users/presentation/http/administration.controller.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { IdentityThrottle } from "../../dist/shared/auth/identity-throttle.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { CreateStaffDto } from "../../dist/modules/users/presentation/http/users.dto.js";

const crypto = new IdentityCrypto({
  otpKey: Buffer.alloc(32, 1),
  encryptionKey: Buffer.alloc(32, 2),
});
const config = { crypto };
const email = "staff@example.com";
const password = "StaffPassword123!";
const status = (expected, code) => (error) =>
  error.getStatus() === expected && (!code || error.message === code);

test("registration rejects normalized existing email in every status without hashing or OTP", async () => {
  for (const accountStatus of [
    "ACTIVE",
    "LOCKED",
    "SUSPENDED",
    "DEACTIVATED",
    "PENDING_VERIFICATION",
  ]) {
    const useCase = new RegisterUseCase(
      {},
      {},
      {
        byEmail: async (_tx, value) => {
          assert.equal(value, email);
          return { accountStatus };
        },
      },
      { requestRegistration: () => assert.fail("duplicate OTP") },
    );
    await assert.rejects(
      useCase.execute({
        email: " STAFF@Example.com ",
        fullName: "Staff Name",
        password,
      }),
      status(409, "EMAIL_ALREADY_EXISTS"),
    );
  }
});

test("new registration still stages a hashed draft and returns the existing acknowledgment", async () => {
  const drafts = [];
  const useCase = new RegisterUseCase(
    {},
    config,
    { byEmail: async () => null },
    { requestRegistration: async (...args) => drafts.push(args) },
  );
  const result = await useCase.execute({
    email: " STAFF@Example.com ",
    fullName: "Staff Name",
    password,
  });
  assert.equal(result.message, "If eligible, instructions will be sent");
  assert.equal(drafts[0][0], email);
  assert.ok(await crypto.verifyPassword(drafts[0][1].passwordHash, password));
});

function staffFixture() {
  const actor = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    securityVersion: 1,
    roles: ["ADMIN"],
    permissions: ["roles.staff.assign"],
  };
  const proofToken = crypto.secret();
  const state = {
    user: null,
    audit: [],
    proof: {
      id: randomUUID(),
      userId: actor.userId,
      sessionId: actor.sessionId,
      securityVersion: 1,
      purpose: "STAFF_ROLE_CHANGE",
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    },
  };
  let failAudit = false;
  let live = actor;
  const tx = { $queryRaw: async () => [] };
  // Unit rollback model only; real locking is tested by the isolated PostgreSQL suite.
  const db = {
    $transaction: async (work) => {
      const before = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  };
  const users = {
    byEmail: async (_tx, value) => {
      assert.equal(value, email);
      return state.user;
    },
    create: async (_tx, data) => {
      state.user = {
        id: randomUUID(),
        ...data,
        role: "USER",
        accountStatus: "PENDING_VERIFICATION",
        emailVerified: false,
      };
      return state.user;
    },
    role: async (_tx, id, role, add, assignedBy) => {
      assert.equal(id, state.user.id);
      assert.equal(add, true);
      assert.equal(assignedBy, actor.userId);
      state.user.role = role;
    },
    activate: async () =>
      Object.assign(state.user, {
        accountStatus: "ACTIVE",
        emailVerified: true,
      }),
  };
  const proofs = {
    proof: async (_tx, digest) =>
      crypto.matches(digest, crypto.secretDigest(proofToken))
        ? state.proof
        : null,
    consumeProof: async () => {
      state.proof.consumedAt = new Date();
    },
  };
  const audit = {
    append: async (_tx, entry) => {
      if (failAudit) throw new Error("audit unavailable");
      state.audit.push(entry);
    },
  };
  const sessions = {
    assertLive: async () => {
      if (!live) throw new UnauthorizedException();
      return live;
    },
  };
  const create = new CreateStaffUseCase(
    db,
    config,
    users,
    sessions,
    new ReauthProofService(config, proofs),
    audit,
  );
  const body = {
    email: " STAFF@Example.com ",
    fullName: "Staff Name",
    password,
    confirmPassword: password,
    reauthToken: proofToken,
  };
  return {
    actor,
    state,
    create,
    body,
    run: () => create.execute(actor, body),
    setFailAudit: (value) => {
      failAudit = value;
    },
    setLive: (value) => {
      live = value;
    },
  };
}

test("Admin creates an immediately ACTIVE verified STAFF with a hashed password and audit, without reason or email delivery", async () => {
  const f = staffFixture();
  const result = await f.run();
  assert.deepEqual(result, { userId: f.state.user.id });
  assert.equal(f.state.user.email, email);
  assert.equal(f.state.user.role, "STAFF");
  assert.equal(f.state.user.accountStatus, "ACTIVE");
  assert.equal(f.state.user.emailVerified, true);
  assert.ok(await crypto.verifyPassword(f.state.user.passwordHash, password));
  assert.ok(f.state.proof.consumedAt);
  assert.equal(f.state.audit[0].action, "STAFF_CREATED");
  assert.equal(f.state.audit[0].actorId, f.actor.userId);
  assert.equal(f.state.audit[0].reason, undefined);
  assert.ok(!JSON.stringify(result).includes(password));
  assert.ok(!JSON.stringify(f.state.audit).includes(password));
  assert.ok(!JSON.stringify(f.state.audit).includes(f.body.reauthToken));
});

test("USER, STAFF, missing permission, stale Admin role and revoked session cannot create staff", async () => {
  for (const roles of [["USER"], ["STAFF"]]) {
    const f = staffFixture();
    f.actor.roles = roles;
    await assert.rejects(f.run(), status(403));
    assert.equal(f.state.user, null);
  }
  const missing = staffFixture();
  missing.actor.permissions = [];
  await assert.rejects(missing.run(), status(403));
  const stale = staffFixture();
  stale.setLive({ ...stale.actor, roles: ["USER"] });
  await assert.rejects(stale.run(), status(403));
  assert.equal(stale.state.proof.consumedAt, null);
  const revoked = staffFixture();
  revoked.setLive(null);
  await assert.rejects(revoked.run(), status(401));
  assert.equal(revoked.state.user, null);
});

test("wrong-session, expired and consumed reauthentication proof cannot create staff", async () => {
  for (const patch of [
    { sessionId: randomUUID() },
    { expiresAt: new Date(0) },
    { consumedAt: new Date() },
  ]) {
    const f = staffFixture();
    Object.assign(f.state.proof, patch);
    await assert.rejects(f.run(), status(401, "REAUTH_REQUIRED"));
    assert.equal(f.state.user, null);
  }
});

test("duplicate email preserves existing account, password and role without consuming proof", async () => {
  const f = staffFixture();
  const original = { id: randomUUID(), role: "USER", passwordHash: "original" };
  f.state.user = original;
  await assert.rejects(f.run(), status(409, "EMAIL_ALREADY_EXISTS"));
  assert.deepEqual(f.state.user, original);
  assert.equal(f.state.proof.consumedAt, null);
  assert.equal(f.state.audit.length, 0);
});

test("audit failure rolls back account, role and proof; the same request can retry", async () => {
  const f = staffFixture();
  f.setFailAudit(true);
  await assert.rejects(f.run(), /audit unavailable/);
  assert.equal(f.state.user, null);
  assert.equal(f.state.proof.consumedAt, null);
  f.setFailAudit(false);
  await f.run();
  assert.equal(f.state.user.role, "STAFF");
});

test("create DTO needs password/confirmation and no reason; rejects weak passwords and privilege injection", async () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const f = staffFixture();
  const result = await pipe.transform(f.body, {
    type: "body",
    metatype: CreateStaffDto,
  });
  assert.equal(result.email, email);
  for (const patch of [
    { reason: "unneeded" },
    { role: "ADMIN" },
    { emailVerified: true },
    { accountStatus: "ACTIVE" },
    { password: undefined },
    { confirmPassword: "Wrong123!" },
    { password: "weak", confirmPassword: "weak" },
    { reauthToken: undefined },
    { invitationToken: "A".repeat(43) },
    { email: "bad" },
  ])
    await assert.rejects(
      pipe.transform(
        { ...f.body, ...patch },
        { type: "body", metatype: CreateStaffDto },
      ),
      status(400),
    );
});

test("HTTP creates staff with 201, duplicate registration returns 409 and no activation route is published", async () => {
  const f = staffFixture();
  const stubs = [
    ...Reflect.getMetadata("design:paramtypes", AuthController),
    ...Reflect.getMetadata("design:paramtypes", AdministrationController),
  ].map((type) => ({ provide: type, useValue: {} }));
  const module = await Test.createTestingModule({
    controllers: [AuthController, AdministrationController],
    providers: [
      ...stubs,
      {
        provide: SessionsService,
        useValue: { principal: async () => f.actor },
      },
    ],
  })
    .overrideProvider(CreateStaffUseCase)
    .useValue(f.create)
    .overrideProvider(RegisterUseCase)
    .useValue(new RegisterUseCase({}, {}, { byEmail: async () => ({}) }, {}))
    .overrideProvider(IdentityThrottle)
    .useValue({ check: async () => {} })
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, "127.0.0.1");
  try {
    const base = await app.getUrl();
    const post = (path, body, bearer) =>
      fetch(`${base}/api/v1/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
    assert.equal((await post("admin/users/staff", f.body)).status, 401);
    const created = await post("admin/users/staff", f.body, "fixture");
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), {
      success: true,
      message: "Staff account created.",
      data: { userId: f.state.user.id },
    });
    assert.equal(
      (await post("admin/users/staff", f.body, "fixture")).status,
      409,
    );
    const duplicate = await post("auth/register", {
      email,
      fullName: "Staff Name",
      password,
      confirmPassword: password,
      agreeTerms: true,
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), {
      success: false,
      message: "EMAIL_ALREADY_EXISTS",
      statusCode: 409,
    });
    assert.equal((await post("auth/staff/activate", {})).status, 404);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    assert.ok(doc.paths["/api/v1/admin/users/staff"].post.responses[201]);
    assert.equal(doc.paths["/api/v1/auth/staff/activate"], undefined);
  } finally {
    await app.close();
  }
});
