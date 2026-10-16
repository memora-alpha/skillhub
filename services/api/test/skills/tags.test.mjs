import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createSkillFixture } from "./helpers.mjs";
import { SkillsService } from "../../dist/modules/skills/application/skills.service.js";
import * as controllers from "../../dist/modules/skills/presentation/http/skills.controller.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

test(
  "canonical Tag lookup HTTP contract on PostgreSQL",
  { timeout: 120000 },
  async (t) => {
    const f = await createSkillFixture();
    let app;
    try {
      await f.db.tag.createMany({
        data: [
          ...Array.from({ length: 21 }, (_, index) => ({
            label: `Tag ${String(index).padStart(2, "0")}`,
            status: "ACTIVE",
          })),
          { label: "Guitar", status: "ACTIVE" },
          { label: "gUiTaR basics", status: "ACTIVE" },
          { label: "100%_\\done", status: "ACTIVE" },
          { label: "100plainXdone", status: "ACTIVE" },
          { label: "Tag inactive", status: "INACTIVE" },
          { label: "Tag archived", status: "ARCHIVED" },
        ].map((row) => ({ ...row, labelKey: row.label.toLowerCase() })),
      });
      const module = await Test.createTestingModule({
        controllers: [
          controllers.SkillsController,
          ...(controllers.TagsController ? [controllers.TagsController] : []),
        ],
        providers: [{ provide: SkillsService, useValue: f.skills }],
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
      const get = async (query = "") => {
        const response = await fetch(`${base}/api/v1/tags${query}`);
        return { status: response.status, body: await response.json() };
      };

      await t.test(
        "public lookup returns only active id/label projections with default pagination",
        async () => {
          const first = await get();
          assert.equal(first.status, 200);
          assert.equal(first.body.success, true);
          assert.equal(first.body.data.length, 20);
          assert.equal(first.body.meta.pagination.limit, 20);
          assert.equal(first.body.meta.pagination.hasMore, true);
          assert.equal(typeof first.body.meta.pagination.nextCursor, "string");
          const all = await get("?limit=100");
          assert.equal(all.status, 200);
          assert.equal(all.body.data.length, 25);
          assert.deepEqual(all.body.meta.pagination, {
            limit: 100,
            hasMore: false,
            nextCursor: null,
          });
          for (const tag of all.body.data) {
            assert.deepEqual(Object.keys(tag).sort(), ["id", "label"]);
            assert.match(tag.id, /^[0-9a-f-]{36}$/);
            assert.equal(typeof tag.label, "string");
          }
          assert.equal(
            all.body.data.some(
              ({ label }) =>
                label === "Tag inactive" || label === "Tag archived",
            ),
            false,
          );
          const second = await get(
            `?cursor=${encodeURIComponent(first.body.meta.pagination.nextCursor)}`,
          );
          assert.equal(second.status, 200);
          assert.equal(second.body.data.length, 5);
          assert.equal(
            new Set(
              [...first.body.data, ...second.body.data].map(({ id }) => id),
            ).size,
            25,
          );
        },
      );

      await t.test(
        "search is case-insensitive and literal, and cursors stay bound to the query",
        async () => {
          const guitars = await get("?q=GUITAR");
          assert.equal(guitars.status, 200);
          assert.deepEqual(guitars.body.data.map(({ label }) => label).sort(), [
            "Guitar",
            "gUiTaR basics",
          ]);
          const literal = await get(`?q=${encodeURIComponent("100%_\\")}`);
          assert.equal(literal.status, 200);
          assert.deepEqual(
            literal.body.data.map(({ label }) => label),
            ["100%_\\done"],
          );
          const first = await get("?q=Tag&limit=1");
          assert.equal(first.status, 200);
          assert.equal(first.body.data[0].label, "Tag 00");
          const cursor = encodeURIComponent(
            first.body.meta.pagination.nextCursor,
          );
          const second = await get(`?q=Tag&limit=2&cursor=${cursor}`);
          assert.equal(second.status, 200);
          assert.deepEqual(
            second.body.data.map(({ label }) => label),
            ["Tag 01", "Tag 02"],
          );
          assert.equal((await get(`?q=Guitar&cursor=${cursor}`)).status, 400);
          const decoded = JSON.parse(
            Buffer.from(
              first.body.meta.pagination.nextCursor,
              "base64url",
            ).toString("utf8"),
          );
          const missingValue = { ...decoded };
          delete missingValue.value;
          for (const malformed of [
            missingValue,
            { ...decoded, id: "not-a-uuid" },
            { ...decoded, value: null },
            { ...decoded, scope: "another-catalog" },
          ]) {
            const token = Buffer.from(JSON.stringify(malformed)).toString(
              "base64url",
            );
            assert.equal((await get(`?q=Tag&cursor=${token}`)).status, 400);
          }
        },
      );

      await t.test(
        "query accepts its documented bounds and rejects unknown or malformed input",
        async () => {
          for (const query of [
            "?q=",
            "?q=a",
            `?q=${"a".repeat(120)}`,
            "?limit=1",
            "?limit=100",
          ]) {
            assert.equal((await get(query)).status, 200, query);
          }
          for (const query of [
            "?status=INACTIVE",
            "?limit=0",
            "?limit=101",
            "?limit=1.5",
            "?limit=no",
            "?limit=1&limit=2",
            "?q=a&q=b",
            `?q=${"a".repeat(121)}`,
            "?cursor=",
            "?cursor=%%%",
            `?cursor=${"a".repeat(1025)}`,
          ]) {
            const response = await get(query);
            assert.equal(response.status, 400, query);
            assert.equal(response.body.success, false);
            assert.equal(response.body.statusCode, 400);
          }
        },
      );

      await t.test(
        "Swagger documents the public route, bounded query and paginated tag response",
        () => {
          const schema = SwaggerModule.createDocument(
            app,
            new DocumentBuilder().setTitle("Tag lookup").build(),
          );
          const operation = schema.paths["/api/v1/tags"]?.get;
          assert.ok(operation);
          assert.ok(operation.summary);
          assert.equal(operation.security?.length ?? 0, 0);
          const params = Object.fromEntries(
            operation.parameters.map((parameter) => [
              parameter.name,
              parameter,
            ]),
          );
          assert.deepEqual(Object.keys(params).sort(), [
            "cursor",
            "limit",
            "q",
          ]);
          assert.deepEqual(
            [params.q.schema.minLength, params.q.schema.maxLength],
            [0, 120],
          );
          assert.deepEqual(
            [
              params.limit.schema.minimum,
              params.limit.schema.maximum,
              params.limit.schema.default,
            ],
            [1, 100, 20],
          );
          assert.equal(params.cursor.schema.maxLength, 1024);
          const envelope =
            operation.responses["200"].content["application/json"].schema;
          assert.equal(
            envelope.properties.data.items.$ref,
            "#/components/schemas/TagResponse",
          );
          assert.ok(
            envelope.properties.meta.properties.pagination.properties
              .nextCursor,
          );
          assert.deepEqual(
            schema.components.schemas.TagResponse.required.sort(),
            ["id", "label"],
          );
          assert.equal(
            schema.components.schemas.TagResponse.properties.id.format,
            "uuid",
          );
          assert.equal(
            schema.components.schemas.TagResponse.properties.label.maxLength,
            80,
          );
          assert.ok(operation.responses["400"]);
        },
      );
    } finally {
      await app?.close();
      await f.dispose();
    }
  },
);
