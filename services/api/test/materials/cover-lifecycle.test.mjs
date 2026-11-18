import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { MaterialThumbnailProcessor } from "../../dist/modules/materials/infrastructure/jobs/material-thumbnail.processor.js";
import { createMaterialFixture } from "./fixture.mjs";

async function makeCover(f, owner, color) {
  const bytes = await sharp({
    create: { width: 960, height: 540, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  const file = await f.readyFile(owner, {
    purpose: "MATERIAL_COVER",
    originalName: "cover.png",
    detectedMime: "image/png",
    sizeBytes: bytes.length,
  });
  f.objects.set(file.objectKey, bytes);
  return file;
}

test("material cover lifecycle on isolated PostgreSQL", async () => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const processor = new MaterialThumbnailProcessor(f.db, f.objectStorage);
    const firstCover = await makeCover(f, owner, { r: 20, g: 60, b: 100 });
    const material = await f.materials.create(
      owner.principal,
      f.draftInput({
        title: "Material with a custom cover",
        coverFileId: firstCover.id,
      }),
    );
    const firstThumbnail = await f.db.materialThumbnail.findFirstOrThrow({
      where: { materialId: material.id, sourceGeneration: 1 },
    });
    assert.equal(
      await processor.process(
        firstThumbnail.id,
        firstThumbnail.sourceGeneration,
      ),
      "READY",
    );
    const detail = await f.materials.getMine(owner.principal, material.id);
    assert.equal(detail.cover.preview.kind, "GENERATED");
    assert.equal("smallObjectKey" in detail.cover.preview, false);
    assert.equal("largeObjectKey" in detail.cover.preview, false);
    const mine = await f.materials.listMine(owner.principal, {});
    const ownerItem = mine.data.find((item) => item.id === material.id);
    assert.ok(ownerItem);
    assert.equal(ownerItem.cover.file.id, firstCover.id);
    assert.equal(ownerItem.cover.file.originalFilename, "cover.png");
    assert.equal(ownerItem.cover.processingStatus, "READY");
    assert.equal(ownerItem.cover.preview.kind, "GENERATED");
    assert.equal("objectKey" in ownerItem.cover.file, false);

    const secondCover = await makeCover(f, owner, { r: 100, g: 40, b: 10 });
    const replaced = await f.materials.update(owner.principal, material.id, {
      expectedListingVersion: material.listingVersion,
      coverFileId: secondCover.id,
    });
    assert.equal(replaced.status, "DRAFT");
    assert.equal(replaced.listingVersion, material.listingVersion + 1);
    assert.equal(replaced.cover.file.id, secondCover.id);
    assert.equal(replaced.cover.processingStatus, "PENDING");
    assert.equal("objectKey" in replaced.cover.file, false);
    assert.equal(
      await f.db.materialThumbnail.count({
        where: { materialId: material.id, status: "SUPERSEDED" },
      }),
      1,
    );
    const secondThumbnail = await f.db.materialThumbnail.findFirstOrThrow({
      where: { materialId: material.id, sourceGeneration: 2 },
    });
    assert.equal(await processor.process(secondThumbnail.id, 2), "READY");

    const removed = await f.materials.update(owner.principal, material.id, {
      expectedListingVersion: replaced.listingVersion,
      coverFileId: null,
    });
    assert.equal(removed.status, "DRAFT");
    assert.equal(removed.cover.file, null);
    assert.equal(removed.cover.processingStatus, "NONE");
    assert.equal(
      (await f.db.material.findUniqueOrThrow({ where: { id: material.id } }))
        .coverFileId,
      null,
    );
  } finally {
    await f.dispose();
  }
});

test("archived covers can finish but a stale job cannot restore a superseded thumbnail", async () => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const cover = await makeCover(f, owner, "blue");
    const live = await f.publishedMaterial(owner, { coverFileId: cover.id });
    let material = await f.materials.archive(
      owner.principal,
      live.id,
      live.listingVersion,
    );
    const currentThumbnail = () =>
      f.db.materialThumbnail.findUniqueOrThrow({
        where: {
          materialId_sourceGeneration: {
            materialId: live.id,
            sourceGeneration: material.cover.generation,
          },
        },
      });
    const processor = new MaterialThumbnailProcessor(f.db, f.objectStorage);
    const first = await currentThumbnail();
    assert.equal(
      await processor.process(first.id, first.sourceGeneration),
      "READY",
    );
    assert.equal(
      (await f.materials.getMine(owner.principal, live.id)).cover.preview.kind,
      "GENERATED",
    );

    await assert.rejects(
      f.materials.update(owner.principal, live.id, {
        expectedListingVersion: material.listingVersion,
        coverFileId: null,
      }),
      /MATERIAL_CONTENT_LOCKED/,
    );
    // Seed a pending job for the immutable cover, then exercise deletion during its read.
    await f.db.materialThumbnail.update({
      where: { id: first.id },
      data: {
        status: "PENDING",
        smallObjectKey: null,
        largeObjectKey: null,
      },
    });
    const next = await currentThumbnail();
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const blockedProcessor = new MaterialThumbnailProcessor(f.db, {
      ...f.objectStorage,
      async read(key) {
        entered.resolve();
        await release.promise;
        return f.objectStorage.read(key);
      },
    });
    const processing = blockedProcessor.process(next.id, next.sourceGeneration);
    try {
      assert.equal(
        await Promise.race([entered.promise.then(() => "READING"), processing]),
        "READING",
      );
      await f.materials.remove(
        owner.principal,
        live.id,
        material.listingVersion,
      );
    } finally {
      release.resolve();
      await processing.catch(() => undefined);
    }
    assert.equal(await processing, "SUPERSEDED");
    const superseded = await currentThumbnail();
    assert.equal(superseded.status, "SUPERSEDED");
    assert.equal(superseded.smallObjectKey, null);
    assert.equal(superseded.largeObjectKey, null);
    assert.ok(
      !f.objects.has(
        `private/material-thumbnails/${live.id}/${next.sourceGeneration}/320x180.webp`,
      ),
    );
    assert.ok(
      !f.objects.has(
        `private/material-thumbnails/${live.id}/${next.sourceGeneration}/640x360.webp`,
      ),
    );
    assert.equal(
      await processor.process(next.id, next.sourceGeneration),
      "SUPERSEDED",
    );
    assert.equal((await currentThumbnail()).attempts, superseded.attempts);
  } finally {
    await f.dispose();
  }
});

test("a worker that sees the old cover row cannot claim its job after deletion", async () => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const cover = await makeCover(f, owner, "green");
    const draft = await f.materials.create(
      owner.principal,
      f.draftInput({ coverFileId: cover.id }),
    );
    const thumbnail = await f.db.materialThumbnail.findFirstOrThrow({
      where: { materialId: draft.id },
    });
    const observed = Promise.withResolvers();
    const release = Promise.withResolvers();
    const processor = new MaterialThumbnailProcessor(
      {
        materialThumbnail: f.db.materialThumbnail,
        material: {
          async findUnique(query) {
            const beforeDelete = await f.db.material.findUnique(query);
            observed.resolve();
            await release.promise;
            return beforeDelete;
          },
        },
      },
      {
        read: () => assert.fail("A superseded job must not read the cover"),
      },
    );
    const running = processor.process(thumbnail.id, thumbnail.sourceGeneration);
    try {
      assert.equal(
        await Promise.race([observed.promise.then(() => "OBSERVED"), running]),
        "OBSERVED",
      );
      await f.materials.remove(owner.principal, draft.id, draft.listingVersion);
    } finally {
      release.resolve();
      await running.catch(() => undefined);
    }
    assert.equal(await running, "SUPERSEDED");
    const row = await f.db.materialThumbnail.findUniqueOrThrow({
      where: { id: thumbnail.id },
    });
    assert.equal(row.attempts, 0);
    assert.equal(row.status, "SUPERSEDED");
  } finally {
    await f.dispose();
  }
});
