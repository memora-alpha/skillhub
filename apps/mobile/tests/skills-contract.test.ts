import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  parseContract,
  publicSkillSchema,
  ownSkillSchema,
} from "../src/features/skills/api/skill-contracts";
import {
  ids,
  ownSkill,
  batch,
  success,
  paginated,
  harness,
} from "./skills-fixtures";

test("paginated transport keeps meta, and existing request returns only data", async () => {
  const h = harness(() => ({
    payload: paginated([ownSkill], "opaque+cursor/"),
  }));
  const page = await h.api.own();
  assert.equal(page.pagination.nextCursor, "opaque+cursor/");
  assert.equal(page.data[0]?.id, ids.sharing);
  assert.deepEqual(await h.client.request("/me"), [ownSkill]);
});
test("paginated transport rejects missing/inconsistent meta instead of treating it as empty", async () => {
  for (const payload of [
    success([]),
    {
      ...paginated([]),
      meta: { pagination: { limit: 20, hasMore: true, nextCursor: null } },
    },
  ]) {
    await assert.rejects(
      harness(() => ({ payload })).api.own(),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
});
test("JSON mutation renews with the same key/body and decimal string", async () => {
  const h = harness((_config, index) =>
    index === 1
      ? { status: 401, payload: { success: false, message: "INVALID_TOKEN" } }
      : { payload: success(ownSkill) },
  );
  await h.api.create(
    {
      skillId: ids.skill,
      levelId: ids.level,
      description: ownSkill.description,
      experienceYears: "0.0",
      isVisible: false,
    },
    "intent-1",
  );
  assert.equal(h.renewals, 1);
  assert.equal(h.calls.length, 2);
  for (const call of h.calls) {
    assert.equal(call.headers.get("Idempotency-Key"), "intent-1");
    assert.equal(JSON.parse(call.data).experienceYears, "0.0");
    assert.equal(JSON.parse(call.data).levelId, ids.level);
    assert.equal("level" in JSON.parse(call.data), false);
    assert.equal("userId" in JSON.parse(call.data), false);
  }
  assert.equal(h.calls[0]?.data, h.calls[1]?.data);
});
test("evidence multipart renews credentials without replaying bytes", async () => {
  const h = harness(() => ({
    status: 401,
    payload: { success: false, message: "INVALID_TOKEN" },
  }));
  const body = new FormData();
  body.append("file", new Blob(["test"]), "proof.pdf");
  await assert.rejects(h.api.upload(ids.sharing, body), AppError);
  assert.equal(h.calls.length, 1);
  assert.equal(h.renewals, 1);
  assert.equal(h.calls[0]?.data, body);
  assert.equal(h.calls[0]?.headers.has("Idempotency-Key"), false);
});
test("owner detail walks active pages, excludes archive, and never falls back", async () => {
  const h = harness((config) => ({
    payload: config.url?.includes("cursor=")
      ? paginated([ownSkill])
      : paginated([{ ...ownSkill, id: ids.other }], "opaque+cursor/"),
  }));
  assert.equal((await h.api.findOwn(ids.sharing))?.id, ids.sharing);
  assert.equal(h.calls.length, 2);
  assert.ok(
    h.calls.every((call) => call.url?.includes("includeArchived=false")),
  );
  assert.ok(h.calls[1]?.url?.includes("cursor=opaque%2Bcursor%2F"));
  assert.equal(await h.api.findOwn(ids.file), null);
});

test("owner detail cannot expose a soft-deleted skill returned by the server", async () => {
  const h = harness(() => ({
    payload: paginated([
      { ...ownSkill, archivedAt: "2026-10-11T00:00:00.000Z" },
    ]),
  }));
  assert.equal(await h.api.findOwn(ids.sharing), null);
});

test("archive requires confirmed deleted state before removing a skill locally", async () => {
  const h = harness(() => ({ payload: success(ownSkill) }));
  await assert.rejects(
    h.api.archive(ids.sharing, 1, "delete"),
    (error) => error instanceof AppError && error.kind === "protocol",
  );
});
test("owner detail rejects repeated cursor and cancelled lookup", async () => {
  const h = harness(() => ({ payload: paginated([], "repeat") }));
  await assert.rejects(h.api.findOwn(ids.sharing), AppError);
  assert.equal(h.calls.length, 2);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(h.api.findOwn(ids.sharing, abort.signal), AppError);
  assert.equal(h.calls.length, 2);
});
test("public projection strips owner metadata and nested private fields", () => {
  const parsed = parseContract(publicSkillSchema, {
    ...ownSkill,
    email: "private@example.test",
    skill: { ...ownSkill.skill, storageKey: "private-key" },
    evidence: ["secret"],
  });
  assert.equal("email" in parsed, false);
  assert.equal("isVisible" in parsed, false);
  assert.equal("latestVerification" in parsed, false);
  assert.equal("storageKey" in parsed.skill, false);
});
test("VERIFIED skill may coexist with PENDING batch; REVOKED is not a badge", () => {
  const parsed = parseContract(ownSkillSchema, {
    ...ownSkill,
    verificationStatus: "VERIFIED",
    latestVerification: batch,
  });
  assert.equal(parsed.verificationStatus, "VERIFIED");
  assert.equal(parsed.latestVerification?.status, "PENDING");
  assert.throws(
    () =>
      parseContract(ownSkillSchema, {
        ...ownSkill,
        verificationStatus: "REVOKED",
      }),
    AppError,
  );
});
test("verification and file status cannot be associated with another resource", async () => {
  const h = harness((config) => ({
    payload: config.url?.includes("evidence-files")
      ? success({ fileId: ids.other, state: "READY" })
      : success({ ...batch, sharingSkillId: ids.other }),
  }));
  await assert.rejects(
    h.api.verification(ids.sharing, ids.verification),
    AppError,
  );
  await assert.rejects(h.api.fileStatus(ids.sharing, ids.file), AppError);
});
test("late skills mutation from account A cannot succeed under account B", async () => {
  let resolve!: (value: { payload: unknown }) => void;
  const h = harness(
    () =>
      new Promise((result) => {
        resolve = result;
      }),
  );
  const pending = h.api.archive(ids.sharing, 1, "archive-a");
  await new Promise((result) => setImmediate(result));
  h.switchAccount();
  resolve({
    payload: success({ ...ownSkill, archivedAt: "2026-10-09T00:00:00.000Z" }),
  });
  await assert.rejects(
    pending,
    (error) => error instanceof AppError && error.kind === "session",
  );
  assert.equal(h.calls.length, 1);
});

test("mutation responses and history are bound to the requested skill", async () => {
  const h = harness((config) => ({
    payload:
      config.method === "get"
        ? paginated([{ ...batch, sharingSkillId: ids.other }])
        : success({ ...ownSkill, id: ids.other }),
  }));
  await assert.rejects(
    h.api.update(
      ids.sharing,
      { expectedVersion: 1, isVisible: true },
      "update",
    ),
    AppError,
  );
  await assert.rejects(h.api.archive(ids.sharing, 1, "archive"), AppError);
  await assert.rejects(h.api.history(ids.sharing), AppError);
  await assert.rejects(
    h.api.create(
      {
        skillId: ids.other,
        levelId: ids.level,
        description: ownSkill.description,
        experienceYears: null,
        isVisible: true,
      },
      "create",
    ),
    AppError,
  );
});
test("409 and 503 are not retried, preserving the explicit mutation intent", async () => {
  for (const status of [409, 503]) {
    const h = harness(() => ({
      status,
      payload: { success: false, message: "STALE_VERSION" },
    }));
    await assert.rejects(
      h.api.update(
        ids.sharing,
        { expectedVersion: 1, isVisible: true },
        "same-key",
      ),
      AppError,
    );
    assert.equal(h.calls.length, 1);
  }
});
