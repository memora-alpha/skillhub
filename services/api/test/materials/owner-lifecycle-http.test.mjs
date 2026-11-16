import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
import { MyMaterialsController } from "../../dist/modules/materials/presentation/http/my-materials.controller.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

async function createOwnerMaterialsApp(service, getActor) {
  const module = await Test.createTestingModule({
    controllers: [MyMaterialsController],
    providers: [
      {
        provide: MaterialsService,
        useValue: service,
      },
    ],
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (ctx) => {
        ctx.switchToHttp().getRequest().principal = getActor();
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication({ logger: false });
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
  return app;
}

test("owner material HTTP validates the status filter and routes detail and soft deletion", async () => {
  const actor = { userId: "11111111-1111-4111-8111-111111111111" };
  const id = "22222222-2222-4222-8222-222222222222";
  const unknownId = "33333333-3333-4333-8333-333333333333";
  const material = { id, status: "ARCHIVED", listingVersion: 2 };
  const pagination = { limit: 1, hasMore: false, nextCursor: null };
  const app = await createOwnerMaterialsApp(
    {
      listMine: (principal, query) => {
        assert.equal(principal, actor);
        assert.equal(query.status, "ARCHIVED");
        assert.equal(query.limit, 1);
        return { data: [material], pagination };
      },
      getMine: (principal, materialId) => {
        assert.equal(principal, actor);
        if (materialId !== id)
          throw new NotFoundException("MATERIAL_NOT_FOUND");
        return material;
      },
      remove: (principal, materialId, version) => {
        assert.equal(principal, actor);
        assert.equal(materialId, id);
        assert.equal(version, 2);
        return { id, deleted: true, replayed: false };
      },
    },
    () => actor,
  );
  try {
    await app.listen(0, "127.0.0.1");
    const path = "/api/v1/me/materials";
    const root = (await app.getUrl()) + path;
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const status = doc.paths[path].get.parameters.find(
      (field) => field.name === "status",
    );
    assert.ok(status?.schema.enum.includes("ARCHIVED"));
    assert.ok(doc.paths[`${path}/{materialId}`].get.responses[404]);
    assert.ok(doc.paths[`${path}/{materialId}`].delete.responses[409]);

    const list = await fetch(root + "?status=ARCHIVED&limit=1");
    assert.equal(list.status, 200);
    const listBody = await list.json();
    assert.deepEqual(listBody.data, [material]);
    assert.deepEqual(listBody.meta.pagination, pagination);
    const invalid = await fetch(root + "?status=DELETED&limit=1");
    assert.equal(invalid.status, 400);
    await invalid.json();
    const detail = await fetch(`${root}/${id}`);
    assert.equal(detail.status, 200);
    assert.deepEqual((await detail.json()).data, material);
    const missing = await fetch(`${root}/${unknownId}`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), {
      success: false,
      statusCode: 404,
      message: "MATERIAL_NOT_FOUND",
    });
    const deleted = await fetch(`${root}/${id}?expectedListingVersion=2`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 200);
    assert.deepEqual((await deleted.json()).data, {
      id,
      deleted: true,
      replayed: false,
    });
  } finally {
    await app.close();
  }
});

test("withdraw HTTP reports current state only to the owner", async () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const id = "33333333-3333-4333-8333-333333333333";
  const actor = { userId: ownerId, permissions: ["material:create:self"] };
  const row = {
    ownerId,
    status: "PUBLISHED",
    listingVersion: 3,
    deletedAt: null,
    legacyArchiveUnclassified: false,
  };
  const service = new MaterialsService({
    run: (work) =>
      work({
        $queryRaw: async () => [],
        material: {
          findUnique: async ({ where }) => (where.id === id ? row : null),
        },
      }),
  });
  const app = await createOwnerMaterialsApp(service, () => actor);
  try {
    await app.listen(0, "127.0.0.1");
    const path = `/api/v1/me/materials/${id}/withdraw`;
    const post = async (version) => {
      const response = await fetch((await app.getUrl()) + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedListingVersion: version }),
      });
      return { status: response.status, body: await response.json() };
    };
    const details = { currentStatus: "PUBLISHED", currentListingVersion: 3 };
    assert.deepEqual(await post(3), {
      status: 409,
      body: {
        success: false,
        statusCode: 409,
        message: "MATERIAL_TRANSITION_INVALID",
        details,
      },
    });
    assert.deepEqual(await post(2), {
      status: 409,
      body: {
        success: false,
        statusCode: 409,
        message: "MATERIAL_VERSION_CONFLICT",
        details,
      },
    });
    assert.equal((await post("3")).status, 400);
    actor.userId = otherId;
    assert.deepEqual(await post(2), {
      status: 404,
      body: {
        success: false,
        statusCode: 404,
        message: "MATERIAL_NOT_FOUND",
      },
    });
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    assert.ok(
      doc.paths["/api/v1/me/materials/{materialId}/withdraw"].post
        .responses[409],
    );
  } finally {
    await app.close();
  }
});
