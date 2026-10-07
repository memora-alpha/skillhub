import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createSkillFixture } from "./helpers.mjs";
import { SkillsService } from "../../dist/modules/skills/application/skills.service.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/sharing-skills.service.js";
import { VerificationsService } from "../../dist/modules/verifications/application/verifications.service.js";
import {
  SkillsController,
  CatalogController,
} from "../../dist/modules/skills/presentation/http/skills.controller.js";
import {
  SharingSkillsController,
  SkillSearchController,
} from "../../dist/modules/sharing-skills/presentation/http/sharing-skills.controller.js";
import { VerificationsController } from "../../dist/modules/verifications/presentation/http/verifications.controller.js";
import { StaffVerificationsController } from "../../dist/modules/verifications/presentation/http/staff-verifications.controller.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

test(
  "actual HTTP controllers, live JWT/session permissions, DTO validation and Swagger",
  { timeout: 120000 },
  async () => {
    const f = await createSkillFixture();
    let app;
    try {
      const admin = await f.account("ADMIN"),
        owner = await f.account(),
        other = await f.account(),
        staff = await f.account("STAFF");
      const module = await Test.createTestingModule({
        controllers: [
          SkillsController,
          CatalogController,
          SharingSkillsController,
          SkillSearchController,
          VerificationsController,
          StaffVerificationsController,
        ],
        providers: [
          { provide: SkillsService, useValue: f.skills },
          { provide: SharingSkillsService, useValue: f.sharing },
          { provide: VerificationsService, useValue: f.verifications },
          { provide: SessionsService, useValue: f.identity.sessions },
          {
            provide: IdentityGuard,
            useValue: new IdentityGuard(f.identity.sessions),
          },
        ],
      }).compile();
      app = module.createNestApplication({ logger: false });
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
      const base = await app.getUrl();
      const request = async (
        method,
        path,
        account,
        body,
        key = randomUUID(),
      ) => {
        const response = await fetch(`${base}/api/v1${path}`, {
          method,
          headers: {
            ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
            ...(body
              ? { "Content-Type": "application/json", "Idempotency-Key": key }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, body: await response.json() };
      };
      assert.equal((await request("GET", "/skills")).status, 200);
      assert.equal(
        (
          await request("POST", "/admin/skills", owner, {
            name: "HTTP skills",
            status: "ACTIVE",
          })
        ).status,
        403,
      );
      const created = await request("POST", "/admin/skills", admin, {
        name: "HTTP skills",
        status: "ACTIVE",
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.success, true);
      const skill = created.body.data;
      const shared = await request("POST", "/me/skills", owner, {
        skillId: skill.id,
        level: "ADVANCED",
        description: "A valid teaching description for the HTTP test",
      });
      assert.equal(shared.status, 201);
      const id = shared.body.data.id;
      assert.equal(
        (
          await request("PATCH", `/me/skills/${id}`, other, {
            expectedVersion: 1,
            description: "Another user's skill cannot be changed",
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await request("PATCH", `/me/skills/${id}`, owner, {
            expectedVersion: 1,
            skillId: randomUUID(),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("PATCH", `/me/skills/${id}`, owner, {
            expectedVersion: 1,
            isVisible: null,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "GET",
            `/skills/${skill.id}/sharers?verifiedOnly=false`,
            other,
          )
        ).body.data.length,
        1,
      );
      assert.equal(
        (
          await request(
            "GET",
            `/skills/${skill.id}/sharers?verifiedOnly=true`,
            other,
          )
        ).body.data.length,
        0,
      );
      assert.equal(
        (
          await request(
            "GET",
            `/skills/${skill.id}/sharers?verifiedOnly=maybe`,
            other,
          )
        ).status,
        400,
      );
      const file = await f.readyFile(owner);
      const submitted = await request(
        "POST",
        `/me/skills/${id}/verifications`,
        owner,
        { fileIds: [file.id] },
      );
      assert.equal(submitted.status, 201);
      assert.equal(
        (await request("GET", "/staff/verifications", other)).status,
        403,
      );
      const approved = await request(
        "POST",
        `/staff/verifications/${submitted.body.data.id}/approve`,
        staff,
        { expectedVersion: 1 },
      );
      assert.equal(approved.status, 200);
      assert.equal(approved.body.data.status, "APPROVED");
      const publicList = await request(
        "GET",
        `/profiles/${owner.user.id}/skills`,
      );
      assert.equal(publicList.status, 200);
      assert.equal(publicList.body.data[0].verificationStatus, "VERIFIED");
      assert.equal(
        JSON.stringify(publicList.body).includes("storageKey"),
        false,
      );
      assert.equal((await request("GET", `/skills?limit=51`)).status, 400);
      const schema = SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle("Skills fixture")
          .addBearerAuth()
          .build(),
      );
      assert.ok(
        schema.paths["/api/v1/me/skills/{sharingSkillId}/verifications"],
      );
      assert.equal(
        schema.components.schemas.VerificationResponse.properties.status.enum.includes(
          "APPROVED",
        ),
        true,
      );
      assert.equal(
        schema.components.schemas.EvidenceResponse.properties.fileSizeBytes
          .type,
        "string",
      );
      await f.db.user.update({
        where: { id: staff.user.id },
        data: { accountStatus: "LOCKED" },
      });
      assert.equal(
        (await request("GET", "/staff/verifications", staff)).status,
        401,
      );
    } finally {
      await app?.close();
      await f.dispose();
    }
  },
);
