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

test("owner material HTTP validates the status filter and routes detail and soft deletion", async () => {
  const actor = { userId: "11111111-1111-4111-8111-111111111111" };
  const id = "22222222-2222-4222-8222-222222222222";
  const unknownId = "33333333-3333-4333-8333-333333333333";
  const material = { id, status: "ARCHIVED", listingVersion: 2 };
  const pagination = { limit: 1, hasMore: false, nextCursor: null };
  const module = await Test.createTestingModule({
    controllers: [MyMaterialsController],
    providers: [
      {
        provide: MaterialsService,
        useValue: {
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
      },
    ],
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (ctx) => {
        ctx.switchToHttp().getRequest().principal = actor;
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
