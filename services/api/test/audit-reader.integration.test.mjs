import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { VersioningType, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createAdminOperationsFixture } from "./admin-operations-fixture.mjs";
import { AuditReader } from "../dist/modules/audit/application/services/audit-reader.js";
import { AuditController } from "../dist/modules/audit/presentation/http/audit.controller.js";
import { IdentityGuard } from "../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../dist/shared/http/http-exception.filter.js";

test(
  "audit HTTP enforces live ADMIN grant and filters/pages real PostgreSQL without exposing snapshots",
  {
    skip: !process.env.TEST_DATABASE_URL,
    timeout: 120_000,
  },
  async () => {
    const f = await createAdminOperationsFixture();
    let app;
    try {
      const admin = await f.account("ADMIN");
      const staff = await f.account("STAFF");
      const user = await f.account();
      assert.ok(admin.principal.permissions.includes("audit:read"));
      assert.ok(!staff.principal.permissions.includes("audit:read"));
      assert.ok(!user.principal.permissions.includes("audit:read"));
      const at = new Date("2026-11-18T00:00:00.000Z");
      const targetId = user.user.id;
      const ids = Array.from(
        { length: 5 },
        (_, n) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
      );
      await f.db.auditLog.createMany({
        data: ids.map((id) => ({
          id,
          actorId: admin.user.id,
          actorKind: "HUMAN",
          actorRoles: ["ADMIN"],
          action: "USER_LOCK",
          targetType: "USER",
          targetId,
          reason: "Fixture review",
          before: { token: "legacy-private-value" },
          after: { status: "LOCKED" },
          createdAt: at,
          ipAddress: "private-ip",
          userAgent: "private-agent",
          requestId: randomUUID(),
          correlationId: randomUUID(),
        })),
      });
      const module = await Test.createTestingModule({
        controllers: [AuditController],
        providers: [
          IdentityGuard,
          { provide: AuditReader, useValue: new AuditReader(f.db) },
          { provide: SessionsService, useValue: f.identity.sessions },
        ],
      }).compile();
      app = module.createNestApplication({ logger: false });
      app.setGlobalPrefix("api");
      app.enableVersioning({ type: VersioningType.URI });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      app.useGlobalFilters(new HttpExceptionFilter());
      await app.listen(0, "127.0.0.1");
      const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1/admin/audit-logs`;
      const read = (account, query = "") =>
        fetch(`${base}${query}`, {
          headers: account ? { authorization: `Bearer ${account.token}` } : {},
        });
      assert.equal((await read()).status, 401);
      assert.equal((await read(staff)).status, 403);
      assert.equal((await read(user)).status, 403);
      assert.equal((await read(admin, "?actorId=bad")).status, 400);
      assert.equal((await read(admin, "?unexpected=1")).status, 400);
      assert.equal((await read(admin, "?from=2026-11-18")).status, 400);
      const filter = new URLSearchParams({
        actorId: admin.user.id,
        targetType: "USER",
        targetId,
        action: "USER_LOCK",
        from: "2026-11-18T07:00:00+07:00",
        to: "2026-11-19T00:00:00Z",
        limit: "2",
      });
      const seen = [];
      let cursor;
      do {
        if (cursor) filter.set("cursor", cursor);
        const response = await read(admin, `?${filter}`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.success, true);
        seen.push(...body.data.map((row) => row.id));
        assert.ok(!JSON.stringify(body).includes("legacy-private-value"));
        assert.ok(!JSON.stringify(body).includes("private-ip"));
        cursor = body.meta.pagination.nextCursor;
      } while (cursor);
      assert.deepEqual(seen, ids.toReversed());
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      assert.ok(
        document.paths["/api/v1/admin/audit-logs"].get.parameters.some(
          (entry) => entry.name === "actorId",
        ),
      );
      assert.ok(document.components.schemas.AuditLogResponse.properties.action);
      // The same issued access token must lose access after its stored role grant is revoked.
      await f.db.rolePermission.deleteMany({
        where: {
          roleId: admin.user.roleId,
          permissionIdRecord: { code: "audit:read" },
        },
      });
      assert.equal((await read(admin)).status, 403);
    } finally {
      await app?.close();
      await f.dispose();
    }
  },
);
