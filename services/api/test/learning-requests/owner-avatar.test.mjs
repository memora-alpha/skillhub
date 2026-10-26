import assert from "node:assert/strict";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { AvatarStorage } from "../../dist/infrastructure/storage/avatar-storage.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";

function harness(rows = []) {
  const calls = { queries: [], signed: [] };
  const storage = {
    url: async (key) => {
      calls.signed.push(key);
      return `https://avatar.test/${key}?signed=true`;
    },
  };
  const tx = {
    user: {
      findMany: async (query) => {
        calls.queries.push(query);
        return rows;
      },
    },
  };
  return { calls, storage, tx, reader: new SkillActorService({}, storage) };
}

test("owner reader batches selected avatars and only signs CLEAN assets", async () => {
  const states = ["CLEAN", "QUARANTINED", "REJECTED", "DELETED", null];
  const rows = states.map((state, index) => ({
    id: `owner-${index}`,
    fullName: `Owner ${index}`,
    email: "private@example.test",
    selectedAvatarRecord: state
      ? { state, storageKey: `avatars/${index}` }
      : null,
  }));
  const f = harness(rows);
  const ids = rows.map(({ id }) => id);
  const owners = await f.reader.readPublicOwners(f.tx, [...ids, ids[0]]);
  assert.equal(f.calls.queries.length, 1);
  assert.deepEqual(f.calls.queries[0].where, { id: { in: ids } });
  assert.deepEqual(f.calls.queries[0].select, {
    id: true,
    fullName: true,
    selectedAvatarRecord: { select: { state: true, storageKey: true } },
  });
  assert.deepEqual(f.calls.signed, ["avatars/0"]);
  assert.deepEqual(
    owners,
    rows.map((row, index) => ({
      id: row.id,
      displayName: row.fullName,
      avatarUrl:
        index === 0 ? "https://avatar.test/avatars/0?signed=true" : null,
    })),
  );
});

test("empty owner input skips database and signing", async () => {
  const f = harness();
  assert.deepEqual(await f.reader.readPublicOwners(f.tx, []), []);
  assert.deepEqual(f.calls, { queries: [], signed: [] });
});

test("owner reader reflects avatar replacement/removal without stored URL snapshots", async () => {
  const row = {
    id: "owner",
    fullName: "Owner",
    selectedAvatarRecord: { state: "CLEAN", storageKey: "avatars/first" },
  };
  const f = harness([row]);
  const read = async () =>
    (await f.reader.readPublicOwners(f.tx, [row.id]))[0].avatarUrl;
  assert.equal(await read(), "https://avatar.test/avatars/first?signed=true");
  row.selectedAvatarRecord = { state: "CLEAN", storageKey: "avatars/second" };
  assert.equal(await read(), "https://avatar.test/avatars/second?signed=true");
  row.selectedAvatarRecord = null;
  assert.equal(await read(), null);
  assert.deepEqual(f.calls.signed, ["avatars/first", "avatars/second"]);
});

test("signer errors propagate rather than becoming a missing avatar", async () => {
  const f = harness([
    {
      id: "owner",
      fullName: "Owner",
      selectedAvatarRecord: { state: "CLEAN", storageKey: "avatars/clean" },
    },
  ]);
  const failure = new Error("Avatar signing unavailable");
  f.storage.url = async () => {
    throw failure;
  };
  await assert.rejects(
    f.reader.readPublicOwners(f.tx, ["owner"]),
    (error) => error === failure,
  );
});

test("IdentityModule owns and wires the owner reader's storage dependency", async () => {
  const providers = Reflect.getMetadata("providers", IdentityModule);
  assert.ok(providers.includes(SkillActorService));
  assert.ok(providers.includes(AvatarStorage));
  const f = harness([
    { id: "owner", fullName: "Owner", selectedAvatarRecord: null },
  ]);
  const module = await Test.createTestingModule({
    providers: [
      SkillActorService,
      { provide: SessionsService, useValue: {} },
      { provide: AvatarStorage, useValue: f.storage },
    ],
  }).compile();
  try {
    assert.equal(
      (await module.get(SkillActorService).readPublicOwners(f.tx, ["owner"]))[0]
        .avatarUrl,
      null,
    );
  } finally {
    await module.close();
  }
});
