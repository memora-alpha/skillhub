import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import { createSkillReadAccess } from "../src/features/skills/utils/skill-read-access";
import { ids, ownSkill, batch } from "./skills-fixtures";

const scope = ["skills", 1, ids.user];
const detail = [...scope, "detail", ids.sharing];
const history = [...scope, "history", ids.sharing];
const verification = [...scope, "verification", ids.sharing, ids.verification];
const denied = () => Promise.reject(new AppError("http", 403));
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  return { client, access: createSkillReadAccess(client, scope, () => true) };
}

test("owner-list denial evicts all private projections but preserves public and other sessions", async () => {
  const { client, access } = setup();
  const own = [...scope, "own", false, "ALL"];
  const publicKey = [...scope, "public", ids.other];
  const otherSession = ["skills", 2, ids.user, "detail", ids.sharing];
  try {
    for (const key of [
      own,
      detail,
      history,
      verification,
      publicKey,
      otherSession,
    ])
      client.setQueryData(key, ownSkill);
    let notifications = 0;
    const unsubscribe = access.subscribe(() => {
      notifications++;
    });
    await assert.rejects(access.read(own, denied));
    for (const key of [own, detail, history, verification]) {
      assert.equal(client.getQueryData(key), undefined);
      assert.ok(access.denied(key));
    }
    assert.ok(client.getQueryData(publicKey));
    assert.ok(client.getQueryData(otherSession));
    await access.read(detail, async () => ownSkill);
    assert.equal(access.denied(detail), undefined);
    assert.ok(
      access.denied(history),
      "a skill read cannot reauthorize verification history",
    );
    assert.ok(
      access.denied([...scope, "own", false, "PENDING"]),
      "new query keys inherit the denial",
    );
    assert.equal(notifications, 2);
    unsubscribe();
  } finally {
    client.clear();
  }
});

test("history denial covers its batches while preserving unrelated skills and their owner metadata", async () => {
  const { client, access } = setup();
  const other = [...scope, "history", ids.other];
  try {
    for (const key of [detail, history, verification, other])
      client.setQueryData(key, batch);
    await assert.rejects(access.read(history, denied));
    assert.ok(access.denied(verification));
    assert.equal(access.denied(detail), undefined);
    assert.equal(access.denied(other), undefined);
    assert.ok(client.getQueryData(other));
    await access.read(history, async () => []);
    assert.ok(
      access.denied(verification),
      "a history refresh does not restore a cached batch",
    );
  } finally {
    client.clear();
  }
});

test("public profile denial evicts its list/detail without hiding owner or other profiles", async () => {
  const { client, access } = setup();
  const list = [...scope, "public", ids.other];
  const publicDetail = [...scope, "public-detail", ids.other, ids.sharing];
  const another = [...scope, "public", ids.user];
  try {
    for (const key of [list, publicDetail, another, detail])
      client.setQueryData(key, ownSkill);
    await assert.rejects(access.read(list, denied));
    assert.equal(client.getQueryData(publicDetail), undefined);
    assert.ok(access.denied(publicDetail));
    assert.ok(client.getQueryData(another));
    assert.ok(client.getQueryData(detail));
    await access.read(list, async () => []);
    assert.ok(access.denied(publicDetail));
  } finally {
    client.clear();
  }
});

test("404 for one verification preserves other batches and the history read", async () => {
  const { client, access } = setup();
  try {
    await assert.rejects(
      access.read(verification, () =>
        Promise.reject(new AppError("http", 404)),
      ),
    );
    assert.ok(access.denied(verification));
    assert.equal(access.denied(history), undefined);
    assert.equal(
      access.denied([...scope, "verification", ids.sharing, ids.other]),
      undefined,
    );
  } finally {
    client.clear();
  }
});

test("a response started before a later denial cannot restore read access", async () => {
  const { client, access } = setup();
  let complete!: (value: typeof ownSkill) => void;
  const delayed = new Promise<typeof ownSkill>((resolve) => {
    complete = resolve;
  });
  try {
    const pending = access.read(detail, () => delayed);
    await assert.rejects(access.read([...scope, "own", false, "ALL"], denied));
    complete(ownSkill);
    await assert.rejects(
      pending,
      (e: unknown) => e instanceof AppError && e.kind === "session",
    );
    assert.ok(access.denied(detail));
  } finally {
    client.clear();
  }
});

test("late responses after session end cannot authorize or deny a replacement session", async () => {
  const client = new QueryClient();
  let current = true;
  const access = createSkillReadAccess(client, scope, () => current);
  const next = createSkillReadAccess(
    client,
    ["skills", 2, ids.user],
    () => true,
  );
  try {
    const pending = access.read(detail, async () => {
      current = false;
      return ownSkill;
    });
    await assert.rejects(pending);
    await assert.rejects(access.read(detail, denied));
    assert.equal(
      next.denied(["skills", 2, ids.user, "detail", ids.sharing]),
      undefined,
    );
  } finally {
    client.clear();
  }
});

test("transient errors alone preserve an allowed snapshot; later cache writes do not lift a denial", async () => {
  const { client, access } = setup();
  try {
    client.setQueryData(detail, ownSkill);
    await assert.rejects(
      access.read(detail, () => Promise.reject(new AppError("http", 503))),
    );
    assert.equal(access.denied(detail), undefined);
    assert.ok(client.getQueryData(detail));
    await assert.rejects(access.read(detail, denied));
    client.setQueryData(detail, ownSkill);
    assert.ok(access.denied(detail));
    client.removeQueries({ queryKey: detail });
    assert.ok(
      access.denied(detail),
      "GC/remount does not discard denial authority",
    );
  } finally {
    client.clear();
  }
});
