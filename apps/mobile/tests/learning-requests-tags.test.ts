import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import {
  draftToInput,
  requestDefaults,
  requestFormSchema,
} from "../src/features/learning-requests/schemas/request-form";
import { requestPatch } from "../src/features/learning-requests/utils/request-policy";
import { fixtureId, fixtureRequest } from "./fixtures/learning-requests-data";
import { fixtureClient } from "./fixtures/learning-requests-client";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";

test("Tag input supports 0/10 distinct UUIDs, rejects 11/duplicates/text, preserves unknown selected labels", () => {
  const initial = fixtureRequest(),
    draft = requestDefaults(initial);
  for (const tagIds of [
    [],
    Array.from({ length: 10 }, (_, i) => fixtureId(20 + i)),
  ])
    assert.equal(
      requestFormSchema(initial).safeParse({ ...draft, tagIds }).success,
      true,
    );
  for (const tagIds of [
    Array.from({ length: 11 }, (_, i) => fixtureId(20 + i)),
    [fixtureId(20), fixtureId(20)],
    ["Thực hành"],
  ])
    assert.equal(
      requestFormSchema(initial).safeParse({ ...draft, tagIds }).success,
      false,
    );
  assert.equal(requestPatch(initial, draftToInput(draft, initial)), null);
  assert.deepEqual(
    requestPatch(initial, draftToInput({ ...draft, tagIds: [] }, initial)),
    { expectedVersion: 1, tagIds: [] },
  );
});
test("Tag lookup uses real endpoint/q/pagination envelope and rejects malformed projection", async () => {
  let path = "";
  const api = createRequestsApi({
    bindSession: () => {},
    request: async (url) => {
      path = url;
      return {
        data: [{ id: fixtureId(20), label: "Thực hành", private: true }],
        meta: { pagination: { limit: 20, nextCursor: null, hasMore: false } },
      };
    },
  });
  const page = await api.tags(undefined, "R & %");
  assert.equal(new URL(path, "https://example.test").pathname, "/tags");
  assert.equal(
    new URL(path, "https://example.test").searchParams.get("q"),
    "R & %",
  );
  assert.deepEqual(page.items, [{ id: fixtureId(20), label: "Thực hành" }]);
  const broken = createRequestsApi({
    bindSession: () => {},
    request: async () => ({
      data: [{ id: "tag-slug", label: "Wrong" }],
      meta: { pagination: { limit: 20, nextCursor: null, hasMore: false } },
    }),
  });
  await assert.rejects(
    broken.tags(),
    (error) => error instanceof AppError && error.kind === "protocol",
  );
});
test("fixture Tag lookup pages, literal search, empty results, failures and retry retain IDs", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(() => fixture.stop());
  const api = fixtureClient(fixture.url);
  const first = await api.tags();
  assert.equal(first.items.length, 20);
  const second = await api.tags(first.nextCursor!);
  assert.equal(second.items.length, 5);
  assert.equal((await api.tags(undefined, "thực")).items[0]?.id, fixtureId(20));
  assert.deepEqual((await api.tags(undefined, "%")).items, []);
  await assert.rejects(
    api.tags(first.nextCursor!, "thực"),
    (error) => error instanceof AppError && error.status === 400,
  );
  await fixture.control({
    rules: [{ path: "/api/v1/tags", kind: "http", status: 503 }],
  });
  const initial = fixtureRequest();
  const draft = requestDefaults(initial);
  await assert.rejects(api.tags(), AppError);
  assert.deepEqual(draft.tagIds, initial.tagIds);
  assert.equal((await api.tags()).items.length, 20);
});
test("fixture server enforces Tag ANY AND Skill/keyword over pages and explicit mutation clear", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(() => fixture.stop());
  const api = fixtureClient(fixture.url);
  const filters = {
    tagIds: [fixtureId(20), fixtureId(21)],
    keyword: "Học",
    skillId: fixtureId(10),
  };
  const page = await api.list("feed", filters);
  assert.ok(page.hasMore);
  const next = await api.list("feed", filters, page.nextCursor!);
  assert.ok(
    next.items.every(
      (item) => "skill" in item && item.skill.id === fixtureId(10),
    ),
  );
  assert.deepEqual(
    (await api.list("feed", { tagIds: [fixtureId(44)] })).items,
    [],
  );
  await assert.rejects(
    api.list("feed", { ...filters, tagIds: [fixtureId(21)] }, page.nextCursor!),
    AppError,
  );
  const created = await api.create(
    draftToInput({ ...requestDefaults(fixtureRequest()), preferredSlots: "" }),
  );
  await assert.rejects(
    api.edit(created.id, {
      expectedVersion: created.version,
      tagIds: [fixtureId(99)],
    }),
    (error) => error instanceof AppError && error.status === 400,
  );
  const changed = await api.edit(created.id, {
    expectedVersion: created.version,
    tagIds: [],
  });
  assert.deepEqual(changed.tagIds, []);
});
