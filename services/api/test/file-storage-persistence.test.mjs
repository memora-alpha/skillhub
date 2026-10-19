import assert from "node:assert/strict";
import { test } from "node:test";
import { skip, withDatabase } from "./integration-db.mjs";
import {
  meta,
  newFile,
  repositoryFor,
  scanRequests,
} from "./stored-file-fixture.mjs";

test(
  "finalize commits QUARANTINED with exactly one scan request, or nothing",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const repository = repositoryFor(prisma);
      const file = newFile();
      await repository.createUploading(file);

      // The outbox append fails after the state CAS: both must roll back.
      await assert.rejects(repository.finalize(meta(file.id, "not-a-uuid")));
      assert.equal((await repository.find(file.id)).state, "UPLOADING");
      assert.equal(await scanRequests(prisma, file.id), 0);

      await repository.finalize(meta(file.id));
      const row = await repository.find(file.id);
      assert.deepEqual(
        [row.state, row.detectedMime, row.sizeBytes],
        ["QUARANTINED", "application/pdf", 9],
      );
      assert.equal(await scanRequests(prisma, file.id), 1);

      await assert.rejects(
        repository.finalize(meta(file.id)),
        /FILE_UPLOAD_STATE_CONFLICT/,
      );
      assert.equal(await scanRequests(prisma, file.id), 1);
    }),
);

test(
  "cleanup and finalize race: whoever wins the state CAS excludes the other",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const repository = repositoryFor(prisma);
      const [stale, live] = [newFile(), newFile()];
      await repository.createUploading(stale);
      await repository.createUploading(live);
      await prisma.$executeRaw`
    UPDATE "stored_files" SET "created_at" = '2000-01-01T00:00:00Z'
    WHERE "id" IN (${stale.id}::uuid, ${live.id}::uuid)`;

      await repository.finalize(meta(live.id));
      const claimed = (
        await repository.claimCleanup(
          new Date(Date.now() - 24 * 60 * 60 * 1000),
          50,
        )
      ).map((item) => item.id);
      assert.ok(claimed.includes(stale.id));
      assert.ok(
        !claimed.includes(live.id),
        "a finalized upload is never a cleanup candidate",
      );

      await assert.rejects(
        repository.finalize(meta(stale.id)),
        /FILE_UPLOAD_STATE_CONFLICT/,
      );
      assert.equal(await scanRequests(prisma, stale.id), 0);
      await repository.markDeleted(stale.id);
      assert.equal((await repository.find(stale.id)).state, "DELETED");
      assert.equal((await repository.find(live.id)).state, "QUARANTINED");
    }),
);
