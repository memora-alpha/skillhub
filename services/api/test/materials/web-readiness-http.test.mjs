import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { MaterialModerationService } from "../../dist/modules/materials/application/services/material-moderation.service.js";
import { MaterialModerationController } from "../../dist/modules/materials/presentation/http/material-moderation.controller.js";
import {
  OwnerMaterialListQueryDto,
  StaffMaterialQueryDto,
} from "../../dist/modules/materials/presentation/http/materials.dto.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

test("Staff material query validates ALL and complete search filters", async () => {
  const input = {
    status: "ALL",
    q: "Kubernetes",
    ownerId: "00000000-0000-4000-8000-000000000001",
    from: "2026-11-01T00:00:00.000Z",
    to: "2026-12-01T00:00:00.000Z",
    limit: "1",
  };
  const parsed = await pipe.transform(input, {
    type: "query",
    metatype: StaffMaterialQueryDto,
  });
  assert.equal(parsed.status, "ALL");
  assert.equal(parsed.q, input.q);
  assert.equal(parsed.ownerId, input.ownerId);
  assert.equal(parsed.from, input.from);
  assert.equal(parsed.limit, 1);
  await assert.rejects(() =>
    pipe.transform(
      { status: "DRAFT" },
      { type: "query", metatype: StaffMaterialQueryDto },
    ),
  );
});

test("owner query does not accept an ownerId override", async () => {
  await assert.rejects(() =>
    pipe.transform(
      { ownerId: "00000000-0000-4000-8000-000000000001" },
      { type: "query", metatype: OwnerMaterialListQueryDto },
    ),
  );
  const parsed = await pipe.transform(
    { q: "Kubernetes", status: "ARCHIVED" },
    { type: "query", metatype: OwnerMaterialListQueryDto },
  );
  assert.equal(parsed.q, "Kubernetes");
});

test("Swagger publishes paginated typed moderation history and search parameters", async () => {
  const module = await Test.createTestingModule({
    controllers: [MaterialModerationController],
    providers: [{ provide: MaterialModerationService, useValue: {} }],
  })
    .overrideGuard(IdentityGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  try {
    await app.init();
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const history =
      doc.paths["/api/v1/staff/materials/{materialId}/moderation-history"].get;
    const schema = history.responses[200].content["application/json"].schema;
    assert.equal(schema.properties.data.type, "array");
    assert.match(
      schema.properties.data.items.$ref,
      /MaterialModerationHistoryResponse$/,
    );
    assert.ok(
      schema.properties.meta.properties.pagination.properties.nextCursor,
    );
    const row = doc.components.schemas.MaterialModerationHistoryResponse;
    for (const name of [
      "action",
      "actor",
      "occurredAt",
      "reason",
      "reviewedListingVersion",
      "listingVersion",
    ])
      assert.ok(row.properties[name]);
    const parameters = doc.paths["/api/v1/staff/materials"].get.parameters.map(
      (entry) => entry.name,
    );
    for (const name of ["q", "ownerId", "from", "to", "status"])
      assert.ok(parameters.includes(name));
  } finally {
    await app.close();
  }
});
