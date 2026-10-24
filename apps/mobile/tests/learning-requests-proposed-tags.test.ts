import assert from "node:assert/strict";
import test from "node:test";
import { proposedTagsSchema } from "../src/features/learning-requests/schemas/request-tags";
import {
  requestDefaults,
  requestFormSchema,
  draftToInput,
} from "../src/features/learning-requests/schemas/request-form";
import {
  ownerSchema,
  publicSchema,
  publicDetailSchema,
} from "../src/features/learning-requests/types";
import { createRequestsApi } from "../src/features/learning-requests/api/requests-api";
import { requestPatch } from "../src/features/learning-requests/utils/request-policy";
import {
  compareRequestDraft,
  rebaseRequestDraft,
} from "../src/features/learning-requests/utils/request-recovery";
import {
  fixtureId,
  fixtureRequest,
  publicFixture,
  fixtureUsers,
} from "./fixtures/learning-requests-data";
import type { RequestOptions } from "../src/lib/http/client";

test("proposed tags follow NFC, whitespace, control and case-insensitive duplicate rules", () => {
  assert.deepEqual(
    proposedTagsSchema.parse(["  React\u00a0  Native  ", "Ca\u0300 phe\u0302"]),
    ["React Native", "Cà phê"],
  );
  assert.equal(proposedTagsSchema.safeParse(["😀".repeat(80)]).success, true);
  assert.equal(proposedTagsSchema.safeParse(["Hoa", "Hoà"]).success, true);
  for (const invalid of [
    null,
    [""],
    ["  "],
    ["😀".repeat(81)],
    ["React\nNative"],
    ["\tReact"],
    ["a\u0000b"],
    ["React", "REACT"],
    ["Cà phê", "Ca\u0300 phe\u0302"],
    ["React Native", "  react   native  "],
  ])
    assert.equal(
      proposedTagsSchema.safeParse(invalid).success,
      false,
      JSON.stringify(invalid),
    );
});

test("form enforces the shared ten-tag budget and normalizes new labels before sending", () => {
  const initial = fixtureRequest();
  const draft = requestDefaults(initial);
  for (const [ids, labels] of [
    [10, 0],
    [9, 1],
    [0, 10],
  ] as const) {
    assert.equal(
      requestFormSchema(initial).safeParse({
        ...draft,
        tagIds: Array.from({ length: ids }, (_, i) => fixtureId(i + 20)),
        proposedTags: Array.from({ length: labels }, (_, i) => `Tag ${i}`),
      }).success,
      true,
    );
  }
  const invalid = requestFormSchema(initial).safeParse({
    ...draft,
    tagIds: Array.from({ length: 10 }, (_, i) => fixtureId(i + 20)),
    proposedTags: ["New"],
  });
  assert.equal(invalid.success, false);
  if (!invalid.success)
    assert.ok(
      invalid.error.issues.some((issue) => issue.path[0] === "proposedTags"),
    );
  assert.deepEqual(
    draftToInput({ ...draft, proposedTags: ["  React   Native "] }, initial)
      .proposedTags,
    ["React Native"],
  );
});

test("owner parsing preserves proposals, defaults old responses and strips them from public projections", () => {
  const initial = fixtureRequest({ proposedTags: ["React Native"] });
  assert.deepEqual(ownerSchema.parse(initial).proposedTags, ["React Native"]);
  const legacy: Partial<typeof initial> = { ...initial };
  delete legacy.proposedTags;
  assert.deepEqual(ownerSchema.parse(legacy).proposedTags, []);
  assert.equal(
    ownerSchema.safeParse({ ...initial, proposedTags: null }).success,
    false,
  );
  const leaked = {
    ...publicFixture({ actor: fixtureUsers[0].id, request: initial }),
    proposedTags: initial.proposedTags,
  };
  assert.equal("proposedTags" in publicSchema.parse(leaked), false);
  assert.equal("proposedTags" in publicDetailSchema.parse(leaked), false);
});

test("PATCH omits unchanged proposals, preserves omission and sends an explicit empty array to clear", () => {
  const initial = fixtureRequest({
    proposedTags: ["React Native", "Phỏng vấn"],
    status: "PENDING_MODERATION",
  });
  const draft = requestDefaults(initial);
  assert.deepEqual(draft.proposedTags, initial.proposedTags);
  const input = draftToInput(draft, initial);
  assert.equal(requestPatch(initial, input), null);
  assert.equal(
    requestPatch(initial, {
      ...input,
      proposedTags: [...initial.proposedTags].reverse(),
    }),
    null,
  );
  const withoutProposals = { ...input };
  delete withoutProposals.proposedTags;
  assert.deepEqual(
    requestPatch(initial, {
      ...withoutProposals,
      title: "Một tiêu đề mới đủ dài",
    }),
    {
      expectedVersion: initial.version,
      title: "Một tiêu đề mới đủ dài",
    },
  );
  assert.deepEqual(requestPatch(initial, { ...input, proposedTags: [] }), {
    expectedVersion: initial.version,
    proposedTags: [],
  });
  assert.deepEqual(
    requestPatch(initial, { ...input, proposedTags: ["Kỹ năng mới"] }),
    { expectedVersion: initial.version, proposedTags: ["Kỹ năng mới"] },
  );
});

test("version comparison shows reviewed proposals and rebasing does not restore tags already approved", () => {
  const initial = fixtureRequest({
    proposedTags: ["React Native"],
    status: "PENDING_MODERATION",
  });
  const approved = {
    ...initial,
    version: 2,
    status: "OPEN" as const,
    tagIds: [...initial.tagIds, fixtureId(900)],
    proposedTags: [],
  };
  const differences = compareRequestDraft(initial, approved);
  assert.ok(
    differences.some(
      (item) => item.field === "proposedTags" && item.label === "Tag đề xuất",
    ),
  );
  const unchanged = rebaseRequestDraft(
    initial,
    requestDefaults(initial),
    approved,
  );
  assert.deepEqual(unchanged.proposedTags, []);
  assert.deepEqual(unchanged.tagIds, approved.tagIds);
  const edited = rebaseRequestDraft(
    initial,
    { ...requestDefaults(initial), proposedTags: ["Phỏng vấn"] },
    approved,
  );
  assert.deepEqual(edited.proposedTags, ["Phỏng vấn"]);
  assert.deepEqual(edited.tagIds, approved.tagIds);
});

test("API create/edit/detail/mine round-trip proposals through existing endpoints without a tag-creation request", async () => {
  let record = fixtureRequest({ status: "DRAFT", proposedTags: [] });
  const calls: { path: string; options: RequestOptions }[] = [];
  const api = createRequestsApi({
    bindSession() {},
    request: async (path, options = {}) => {
      calls.push({ path, options });
      if (options.method === "POST" || options.method === "PATCH") {
        record = { ...record, ...(options.body as Partial<typeof record>) };
        return record;
      }
      if (path.startsWith("/learning-requests/mine"))
        return {
          data: [record],
          meta: { pagination: { nextCursor: null, hasMore: false, limit: 20 } },
        };
      return record;
    },
  });
  const input = draftToInput(
    { ...requestDefaults(record), proposedTags: ["  React   Native  "] },
    record,
  );
  const created = await api.create(input);
  assert.deepEqual(created.proposedTags, ["React Native"]);
  assert.equal(calls[0]?.path, "/learning-requests");
  assert.deepEqual((calls[0]?.options.body as typeof input).proposedTags, [
    "React Native",
  ]);
  assert.deepEqual(
    ((await api.detail(record.id)) as typeof record).proposedTags,
    ["React Native"],
  );
  const mine = await api.list("mine");
  assert.deepEqual((mine.items[0] as typeof record).proposedTags, [
    "React Native",
  ]);
  const clear = requestPatch(created, { ...input, proposedTags: [] })!;
  assert.deepEqual((await api.edit(record.id, clear)).proposedTags, []);
  assert.equal(calls.at(-1)?.path, `/learning-requests/${record.id}`);
  assert.equal(calls.at(-1)?.options.method, "PATCH");
  assert.deepEqual(clear, {
    expectedVersion: created.version,
    proposedTags: [],
  });
  assert.ok(
    calls.every(
      (call) =>
        call.path.startsWith("/learning-requests") &&
        call.options.authenticated,
    ),
  );
});
