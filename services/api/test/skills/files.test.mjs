import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createSkillFixture } from "./helpers.mjs";

test(
  "evidence streaming cap, scan transition, binding, downloads and cleanup race",
  { timeout: 120000 },
  async () => {
    const f = await createSkillFixture();
    try {
      const admin = await f.account("ADMIN"),
        owner = await f.account(),
        other = await f.account(),
        staff = await f.account("STAFF");
      const skill = await f.skills.create(f.command(admin), {
        name: "File skills",
        status: "ACTIVE",
      });
      const sharing = await f.sharing.create(f.command(owner), {
        skillId: skill.id,
        level: "ADVANCED",
        description: "A sufficiently detailed teaching description",
      });
      const upload = (body) =>
        f.verifications.upload(owner.principal, sharing.id, {
          name: "evidence.pdf",
          claimedMime: "application/pdf",
          body: Readable.from([body]),
          correlationId: f.command(owner).context.correlationId,
        });
      // Configuration advertises 100 MB; the product ceiling still applies.
      await assert.rejects(
        upload(Buffer.alloc(10_000_001)),
        (e) =>
          e.status === 413 || e.statusCode === 413 || e.getStatus?.() === 413,
      );
      assert.equal(
        await f.db.storedFile.count({ where: { state: "UPLOAD_FAILED" } }),
        1,
      );
      const uploaded = await upload(Buffer.from("%PDF-1.7\n%%EOF\n"));
      const boundary = Buffer.alloc(10_000_000, 32);
      boundary.write("%PDF-1.7\n");
      boundary.write("\n%%EOF\n", boundary.length - 8);
      assert.equal((await upload(boundary)).state, "QUARANTINED");
      assert.equal(uploaded.state, "QUARANTINED");
      await assert.rejects(
        f.verifications.submit(f.command(owner), sharing.id, {
          fileIds: [uploaded.fileId],
        }),
        (e) => e.getStatus?.() === 409,
      );
      const claim = await f.stored.claim(uploaded.fileId, 1);
      assert.ok(claim);
      assert.equal(
        await f.stored.complete({
          claim,
          verdict: "CLEAN",
          scannerVersion: "test-scanner",
        }),
        true,
      );
      const submitted = await f.verifications.submit(
        f.command(owner),
        sharing.id,
        { fileIds: [uploaded.fileId] },
      );
      const evidenceId = submitted.files[0].id;
      assert.equal(
        (
          await f.verifications.download(
            owner.principal,
            sharing.id,
            undefined,
            evidenceId,
          )
        ).url.startsWith("https://fixture.invalid/"),
        true,
      );
      await assert.rejects(
        f.verifications.download(
          other.principal,
          sharing.id,
          undefined,
          evidenceId,
        ),
      );
      assert.ok(
        await f.verifications.download(
          staff.principal,
          undefined,
          submitted.id,
          evidenceId,
        ),
      );
      const deadline = new Date(Date.now() + 1000);
      assert.equal(
        (await f.stored.claimCleanup(deadline, 50)).some(
          (row) => row.id === uploaded.fileId,
        ),
        false,
      );
      await f.verifications.decide(
        f.command(staff),
        submitted.id,
        {
          expectedVersion: 1,
          rejectReason: "This file does not demonstrate the claimed skill",
        },
        false,
      );
      assert.equal(
        (await f.stored.claimCleanup(deadline, 50)).some(
          (row) => row.id === uploaded.fileId,
        ),
        false,
      );
      const aged = await f.readyFile(owner, {
        createdAt: new Date(Date.now() - 48 * 3600000),
      });
      const race = await Promise.allSettled([
        f.verifications.submit(f.command(owner), sharing.id, {
          fileIds: [aged.id],
        }),
        f.stored.claimCleanup(new Date(Date.now() - 24 * 3600000), 50),
      ]);
      assert.equal(race[1].status, "fulfilled", race[1].reason?.message);
      const current = await f.db.storedFile.findUniqueOrThrow({
        where: { id: aged.id },
      });
      if (race[0].status === "fulfilled") {
        assert.equal(current.state, "READY");
        assert.ok(current.attachedAt);
        assert.equal(
          race[1].value.some((row) => row.id === aged.id),
          false,
        );
      } else {
        assert.equal(current.state, "CLEANUP_PENDING");
        assert.equal(current.attachedAt, null);
      }
      await f.db.user.update({
        where: { id: staff.user.id },
        data: { accountStatus: "LOCKED" },
      });
      await assert.rejects(
        f.verifications.download(
          staff.principal,
          undefined,
          submitted.id,
          evidenceId,
        ),
      );
    } finally {
      await f.dispose();
    }
  },
);
