import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Controller,
  Get,
  Injectable,
  Module,
  Req,
  UseGuards,
} from "@nestjs/common";
import { APP_FILTER, NestFactory } from "@nestjs/core";
import { AUTHORIZATION_READER } from "../dist/shared/authorization/authorization.types.js";
import { AccessControlService } from "../dist/shared/authorization/access-control.service.js";
import { Authenticated } from "../dist/shared/authorization/access.decorators.js";
import { PermissionGuard } from "../dist/shared/authorization/permission.guard.js";
import { HttpExceptionFilter } from "../dist/shared/http/http-exception.filter.js";
import { FileStorageService } from "../dist/infrastructure/storage/file-storage.service.js";

// Fixture consumer only: production routes belong to verification/conversation/report modules.
const owner = "11111111-1111-4111-8111-111111111111";
const outsider = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const ownersVerification = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const outsidersVerification = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const readyFile = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const pendingFile = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const actorOf = (userId, role) => ({
  userId,
  accountStatus: "ACTIVE",
  roles: [role],
  permissions: new Set(),
  blockedPermissions: new Set(),
});
const users = new Map([
  [owner, actorOf(owner, "USER")],
  [outsider, actorOf(outsider, "USER")],
  [admin, actorOf(admin, "ADMIN")],
]);
const tokens = new Map([
  ["owner", owner],
  ["outsider", outsider],
  ["admin", admin],
]);

const fileRow = (id, state) => ({
  id,
  purpose: "EVIDENCE",
  uploadedBy: owner,
  objectKey: `private/${id}`,
  generation: 1,
  originalName: "evidence.pdf",
  detectedMime: "application/pdf",
  sizeBytes: 4,
  sha256: "0".repeat(64),
  state,
});
const files = new Map([
  [readyFile, fileRow(readyFile, "READY")],
  [pendingFile, fileRow(pendingFile, "QUARANTINED")],
]);
const signedKeys = [];
const service = new FileStorageService(
  { find: async (id) => files.get(id) ?? null },
  {
    head: async () => ({ size: 4 }),
    signGet: async (key) => (
      signedKeys.push(key),
      "https://objects.example.test/signed"
    ),
  },
  {
    getSnapshot: async () => ({
      values: { "storage.downloadTtlSeconds": 120 },
    }),
  },
);

// Module-owned policy: binding and parent ownership come from the server, never from role or body.
const parentOwner = new Map([
  [ownersVerification, owner],
  [outsidersVerification, outsider],
]);
const bindings = new Map([
  [readyFile, ownersVerification],
  [pendingFile, ownersVerification],
]);
const policy = {
  async assertRead({ actor, fileId, resource }) {
    if (
      resource.type !== "verification" ||
      bindings.get(fileId) !== resource.id ||
      parentOwner.get(resource.id) !== actor.userId
    )
      throw new Error("denied");
  },
};

class FixtureIdentityGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const userId = tokens.get(
      request.headers.authorization?.replace("Bearer fixture-", ""),
    );
    if (userId)
      request.authenticatedIdentity = { userId, sessionId: "fixture-only" };
    return true;
  }
}
Injectable()(FixtureIdentityGuard);

class DownloadController {
  download(request) {
    return service.issueDownload(
      {
        actor: request.actor,
        fileId: request.params.fileId,
        resource: { type: "verification", id: request.params.verificationId },
      },
      policy,
    );
  }
}
const descriptor = Object.getOwnPropertyDescriptor(
  DownloadController.prototype,
  "download",
);
Controller("verifications")(DownloadController);
Get(":verificationId/files/:fileId/download")(
  DownloadController.prototype,
  "download",
  descriptor,
);
Req()(DownloadController.prototype, "download", 0);
Authenticated()(DownloadController.prototype, "download", descriptor);
UseGuards(FixtureIdentityGuard, PermissionGuard)(
  DownloadController.prototype,
  "download",
  descriptor,
);

class TestModule {}
Module({
  controllers: [DownloadController],
  providers: [
    FixtureIdentityGuard,
    PermissionGuard,
    AccessControlService,
    {
      provide: AUTHORIZATION_READER,
      useValue: { loadActor: async (userId) => users.get(userId) ?? null },
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})(TestModule);

test("download is signed only for the bound parent's owner; others get 404 and pending gets 409", async () => {
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/verifications`;
  const get = (token, verificationId, fileId) =>
    fetch(`${base}/${verificationId}/files/${fileId}/download`, {
      headers: token ? { authorization: `Bearer fixture-${token}` } : {},
    });
  const denied = async (response, status, message) => {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.deepEqual(body, { error: { statusCode: status, message } });
    assert.doesNotMatch(JSON.stringify(body), /signed|private\//);
  };
  try {
    assert.equal(
      (await get(undefined, ownersVerification, readyFile)).status,
      401,
    );
    await denied(
      await get("outsider", ownersVerification, readyFile),
      404,
      "FILE_NOT_FOUND",
    );
    await denied(
      await get("admin", ownersVerification, readyFile),
      404,
      "FILE_NOT_FOUND",
    );
    // Own parent, someone else's file: nested-parent mismatch must not leak the file.
    await denied(
      await get("outsider", outsidersVerification, readyFile),
      404,
      "FILE_NOT_FOUND",
    );
    await denied(
      await get("owner", ownersVerification, pendingFile),
      409,
      "FILE_NOT_READY",
    );
    assert.deepEqual(signedKeys, []);

    const allowed = await get("owner", ownersVerification, readyFile);
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.url, "https://objects.example.test/signed");
    assert.ok(Date.parse(body.expiresAt) > Date.now());
    assert.equal("objectKey" in body, false);
    assert.deepEqual(signedKeys, [`private/${readyFile}`]);
  } finally {
    await app.close();
  }
});
