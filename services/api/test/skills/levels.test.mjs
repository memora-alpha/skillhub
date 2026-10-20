import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createSkillFixture } from "./helpers.mjs";
import {
  SkillLevelsController,
  AdminSkillLevelsController,
} from "../../dist/modules/skills/presentation/http/skill-levels.controller.js";
import { SkillLevelsService } from "../../dist/modules/skills/application/services/skill-levels.service.js";
import { SharingSkillsController } from "../../dist/modules/sharing-skills/presentation/http/sharing-skills.controller.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/services/sharing-skills.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

const status = (code) => (error) => error.getStatus?.() === code;
const input = {
  code: "B2",
  name: "Upper intermediate",
  sortOrder: 10,
  status: "ACTIVE",
  reason: "Add CEFR proficiency",
};

test(
  "upgrade backfills active and archived legacy selections without replacing records",
  { timeout: 120000 },
  async () => {
    const skillId = randomUUID(),
      ownerId = randomUUID();
    const activeId = randomUUID(),
      archivedId = randomUUID();
    const f = await createSkillFixture(undefined, async (client) => {
      await client.query(
        "INSERT INTO skills(skill_id,name,name_key,slug,status,updated_at) VALUES($1,'Legacy level skill','legacy level skill','legacy-level-skill','ARCHIVED',CURRENT_TIMESTAMP)",
        [skillId],
      );
      await client.query(
        `INSERT INTO users(user_id,role_id,normalized_email,account_status,email_verified,security_version,failed_login_count,terms_version,terms_accepted_at,full_name,locale,reputation_score,verified_skill_count,completed_session_count,updated_at)
      SELECT $1,role_id,$2,'ACTIVE',true,1,0,'test',CURRENT_TIMESTAMP,'Legacy level owner','vi',50,0,0,CURRENT_TIMESTAMP FROM roles WHERE code='USER'`,
        [ownerId, `${ownerId}@fixture.invalid`],
      );
      await client.query(
        `INSERT INTO sharing_skills(sharing_skill_id,user_id,skill_id,level,description,verification_status,is_visible,archived_at,updated_at)
      VALUES($1,$2,$3,'ADVANCED','A historical level selection preserved during upgrade','UNVERIFIED',true,NULL,CURRENT_TIMESTAMP),
      ($4,$2,$3,'BEGINNER','An archived historical level preserved during upgrade','UNVERIFIED',false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [activeId, ownerId, skillId, archivedId],
      );
    });
    try {
      for (const [id, code] of [
        [activeId, "ADVANCED"],
        [archivedId, "BEGINNER"],
      ]) {
        const row = await f.sharing.read(id);
        assert.equal(row.levelIdRecord.skillId, skillId);
        assert.equal(row.levelIdRecord.code, code);
        assert.equal(row.level, code);
        assert.equal(row.version, 1);
      }
      assert.ok((await f.sharing.read(archivedId)).archivedAt);
      assert.equal(
        (await f.db.skill.findUniqueOrThrow({ where: { id: skillId } })).status,
        "ARCHIVED",
      );
    } finally {
      await f.dispose();
    }
  },
);

test(
  "per-skill level catalog: HTTP, relational invariants and atomic commands",
  { timeout: 180000 },
  async (t) => {
    const f = await createSkillFixture();
    let app;
    try {
      const admin = await f.account("ADMIN"),
        staff = await f.account("STAFF"),
        owner = await f.account();
      const skill = await f.skills.create(f.command(admin), {
        name: "English catalog",
        status: "ACTIVE",
      });
      const another = await f.skills.create(f.command(admin), {
        name: "Japanese catalog",
        status: "ACTIVE",
      });
      const module = await Test.createTestingModule({
        controllers: [
          SkillLevelsController,
          AdminSkillLevelsController,
          SharingSkillsController,
        ],
        providers: [
          { provide: SkillLevelsService, useValue: f.levels },
          { provide: SharingSkillsService, useValue: f.sharing },
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
      const request = async (method, path, actor, body, key = randomUUID()) => {
        const response = await fetch(`${base}/api/v1${path}`, {
          method,
          headers: {
            ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
            ...(body
              ? { "Content-Type": "application/json", "Idempotency-Key": key }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, body: await response.json() };
      };
      const path = `/admin/skills/${skill.id}/levels`;
      let level;
      await t.test(
        "public defaults, Admin permissions, DTOs and idempotency",
        async () => {
          const defaults = await request("GET", `/skills/${skill.id}/levels`);
          assert.equal(defaults.status, 200);
          assert.deepEqual(
            defaults.body.data.map((row) => row.code),
            ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"],
          );
          assert.equal((await request("GET", path)).status, 401);
          for (const actor of [owner, staff])
            assert.equal(
              (await request("POST", path, actor, input)).status,
              403,
            );
          for (const body of [
            { ...input, code: "b2" },
            { ...input, name: " " },
            { ...input, sortOrder: -1 },
            { ...input, reason: " " },
            { ...input, status: "ARCHIVED" },
            { ...input, extra: true },
          ]) {
            assert.equal(
              (await request("POST", path, admin, body)).status,
              400,
            );
          }
          assert.equal(
            (await request("POST", path, admin, input, "")).status,
            400,
          );
          const key = randomUUID();
          const created = await request("POST", path, admin, input, key);
          assert.equal(created.status, 201);
          level = created.body.data;
          assert.equal(
            (await request("POST", path, admin, input, key)).body.data.id,
            level.id,
          );
          assert.equal(
            (
              await request(
                "POST",
                path,
                admin,
                { ...input, name: "Changed payload" },
                key,
              )
            ).status,
            409,
          );
          assert.equal((await request("POST", path, admin, input)).status, 409);
          assert.equal(
            (
              await request("POST", path, admin, {
                ...input,
                code: "OTHER",
                name: " UPPER   intermediate ",
              })
            ).status,
            409,
          );
          assert.equal(
            await f.db.auditLog.count({
              where: { targetId: level.id, action: "SKILL_LEVEL_UPDATE" },
            }),
            1,
          );
          assert.equal(
            (
              await request("PATCH", `${path}/${level.id}`, admin, {
                expectedVersion: 1,
                reason: "No changes",
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("PATCH", `${path}/${level.id}`, admin, {
                expectedVersion: 1,
                reason: "Immutable code",
                code: "B3",
              })
            ).status,
            400,
          );
          for (const patch of [
            { name: null },
            { status: null },
            { sortOrder: null },
          ])
            assert.equal(
              (
                await request("PATCH", `${path}/${level.id}`, admin, {
                  ...patch,
                  expectedVersion: 1,
                  reason: "Invalid clearing",
                })
              ).status,
              400,
            );
        },
      );

      let sharing;
      await t.test(
        "select by id, legacy compatibility, cross-skill FK and projections",
        async () => {
          const body = {
            skillId: skill.id,
            levelId: level.id,
            description:
              "Practical English lessons with conversation exercises",
          };
          for (const invalid of [
            { ...body, level: "BEGINNER" },
            { ...body, levelId: null },
            { ...body, levelId: undefined },
            { ...body, levelId: "bad" },
          ])
            assert.equal(
              (await request("POST", "/me/skills", owner, invalid)).status,
              400,
            );
          assert.equal(
            (
              await request("POST", "/me/skills", owner, {
                ...body,
                skillId: another.id,
              })
            ).status,
            404,
          );
          const result = await request("POST", "/me/skills", owner, body);
          assert.equal(result.status, 201);
          sharing = result.body.data;
          assert.equal(sharing.level, "B2");
          assert.equal(sharing.levelId, level.id);
          assert.equal(sharing.skillLevel.name, input.name);
          assert.equal(
            (await f.sharing.publicList(owner.user.id, { limit: 20 })).data[0]
              .level,
            "B2",
          );
          const offered = await f.db.$transaction((tx) =>
            f.sharing.readRequestOfferings(tx, [sharing.id]),
          );
          assert.equal(offered[0].level, "B2");
          assert.equal(offered[0].levelId, level.id);
          await assert.rejects(
            f.db.sharingSkill.update({
              where: { id: sharing.id },
              data: { skillId: another.id },
            }),
          );
          const legacy = await f.sharing.create(f.command(owner), {
            skillId: another.id,
            level: "ADVANCED",
            description: body.description,
          });
          assert.equal(legacy.level, "ADVANCED");
          assert.ok(legacy.levelId);
          assert.equal(
            (
              await request("PATCH", `/me/skills/${sharing.id}`, owner, {
                expectedVersion: sharing.version,
                levelId: null,
              })
            ).status,
            400,
          );
        },
      );

      await t.test(
        "inactive levels retain history, reject new selections and support restore",
        async () => {
          const update = {
            expectedVersion: 1,
            status: "INACTIVE",
            name: "B2 proficiency",
            description: null,
            reason: "Retire this level from new selections",
          };
          const key = randomUUID();
          assert.equal(
            (await request("PATCH", `${path}/${level.id}`, admin, update, key))
              .status,
            200,
          );
          assert.equal(
            (await request("PATCH", `${path}/${level.id}`, admin, update, key))
              .body.data.version,
            2,
          );
          assert.equal(
            (await request("PATCH", `${path}/${level.id}`, admin, update))
              .status,
            409,
          );
          assert.equal(
            (await request("GET", `/skills/${skill.id}/levels`)).body.data.some(
              (row) => row.id === level.id,
            ),
            false,
          );
          assert.equal(
            (await request("GET", path, admin)).body.data.some(
              (row) => row.id === level.id,
            ),
            true,
          );
          assert.equal(
            (await f.sharing.ownList(owner.principal, { limit: 20 })).data.find(
              (row) => row.id === sharing.id,
            ).skillLevel.status,
            "INACTIVE",
          );
          assert.equal(
            (
              await request("PATCH", `/me/skills/${sharing.id}`, owner, {
                expectedVersion: sharing.version,
                levelId: level.id,
              })
            ).status,
            409,
          );
          const nextOwner = await f.account();
          await assert.rejects(
            f.sharing.create(f.command(nextOwner), {
              skillId: skill.id,
              levelId: level.id,
              description: "Cannot select a retired English proficiency level",
            }),
            status(409),
          );
          assert.equal(
            (
              await request("PATCH", `${path}/${level.id}`, admin, {
                expectedVersion: 2,
                status: "ACTIVE",
                reason: "Allow B2 selection again",
              })
            ).status,
            200,
          );
          const changed = await f.sharing.change(f.command(owner), sharing.id, {
            expectedVersion: sharing.version,
            level: "EXPERT",
          });
          assert.equal(changed.level, "EXPERT");
          const restored = await f.sharing.change(
            f.command(owner),
            sharing.id,
            { expectedVersion: changed.version, levelId: level.id },
          );
          assert.equal(restored.level, "B2");
        },
      );

      await t.test(
        "rollback and concurrent edits preserve audit/version integrity",
        async () => {
          const original = f.audit.append.bind(f.audit);
          try {
            f.audit.append = async () => {
              throw new Error("Injected audit failure");
            };
            await assert.rejects(
              f.levels.create(f.command(admin), skill.id, {
                ...input,
                code: "C1",
                name: "Advanced CEFR",
              }),
              /Injected audit failure/u,
            );
            assert.equal(
              await f.db.skillLevel.count({
                where: { skillId: skill.id, code: "C1" },
              }),
              0,
            );
          } finally {
            f.audit.append = original;
          }
          const editors = [admin, await f.account("ADMIN")];
          const changes = await Promise.allSettled(
            ["First label", "Second label"].map((name, index) =>
              f.levels.update(f.command(editors[index]), skill.id, level.id, {
                name,
                expectedVersion: 3,
                reason: "Concurrent editorial update",
              }),
            ),
          );
          assert.equal(
            changes.filter((result) => result.status === "fulfilled").length,
            1,
          );
          assert.equal(
            changes.find((result) => result.status === "rejected").reason
              .message,
            "STALE_VERSION",
          );
          const replay = f.command(admin);
          const body = { ...input, code: "C2", name: "Proficient CEFR" };
          await f.levels.create(replay, skill.id, body);
          await f.db.rolePermission.deleteMany({
            where: {
              roleIdRecord: { code: "ADMIN" },
              permissionIdRecord: { code: "skill-level:manage" },
            },
          });
          await assert.rejects(
            f.levels.create(replay, skill.id, body),
            status(403),
          );
        },
      );

      const schema = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle("Skill levels").addBearerAuth().build(),
      );
      assert.ok(
        schema.paths["/api/v1/admin/skills/{skillId}/levels/{levelId}"].patch,
      );
      assert.equal(
        schema.paths["/api/v1/skills/{skillId}/levels"].get.responses["200"]
          .content["application/json"].schema.properties.data.type,
        "array",
      );
      assert.equal(
        schema.components.schemas.SharingResponse.properties.level.enum,
        undefined,
      );
    } finally {
      await app?.close();
      await f.dispose();
    }
  },
);
