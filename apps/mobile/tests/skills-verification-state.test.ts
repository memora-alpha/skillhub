import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  ownSkillSchema,
  verificationSchema,
} from "../src/features/skills/api/skill-contracts";
import { ids, ownSkill, batch } from "./skills-fixtures";
import {
  hasPendingVerification,
  withSubmittedVerification,
  verificationItems,
  observeVerificationDecisions,
} from "../src/features/skills/utils/verification-state";
import { recordVerificationQueries } from "../src/features/skills/utils/record-verification-queries";
import { filteredSkillPage } from "../src/features/skills/utils/skill-filter";

test("history and detail decisions release only the matching submitted snapshot", () => {
  const pending = verificationSchema.parse(batch);
  for (const status of ["APPROVED", "REJECTED"]) {
    const submitted = new Map([[ids.sharing, pending]]);
    const decision = verificationSchema.parse({ ...batch, status, version: 2 });
    assert.equal(observeVerificationDecisions([decision], submitted), true);
    assert.equal(submitted.size, 0);
    assert.equal(observeVerificationDecisions([decision], submitted), false);
  }
  const submitted = new Map([[ids.sharing, { ...pending, version: 2 }]]);
  for (const item of [
    pending,
    { ...pending, status: "APPROVED" as const },
    { ...pending, version: 3, status: "APPROVED" as const, id: ids.other },
    {
      ...pending,
      version: 3,
      status: "APPROVED" as const,
      sharingSkillId: ids.other,
    },
  ])
    assert.equal(observeVerificationDecisions([item], submitted), false);
  assert.equal(submitted.size, 1);
});

test("pending includes a verified skill awaiting another request, and walks later pages", async () => {
  const verifiedPending = ownSkillSchema.parse({
    ...ownSkill,
    verificationStatus: "VERIFIED",
    latestVerification: batch,
  });
  const result = await filteredSkillPage(
    async (cursor) => ({
      data: cursor ? [verifiedPending] : [ownSkillSchema.parse(ownSkill)],
      pagination: {
        limit: 20,
        hasMore: !cursor,
        nextCursor: cursor ? null : "next",
      },
    }),
    "PENDING",
  );
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.verificationStatus, "VERIFIED");
  assert.equal(hasPendingVerification(verifiedPending), true);
  assert.equal(
    hasPendingVerification(
      ownSkillSchema.parse({
        ...ownSkill,
        verificationStatus: "PENDING",
        latestVerification: null,
      }),
    ),
    true,
  );
});

test("confirmed submit survives stale reads while preserving verified badge and server version", () => {
  const submitted = new Map([[ids.sharing, verificationSchema.parse(batch)]]);
  const updated = withSubmittedVerification(
    ownSkillSchema.parse(ownSkill),
    submitted,
  );
  assert.equal(updated.verificationStatus, "PENDING");
  assert.equal(updated.version, ownSkill.version);
  assert.equal(updated.latestVerification?.id, ids.verification);
  const verified = withSubmittedVerification(
    ownSkillSchema.parse({ ...ownSkill, verificationStatus: "VERIFIED" }),
    submitted,
  );
  assert.equal(verified.verificationStatus, "VERIFIED");
  assert.equal(hasPendingVerification(verified), true);
});

test("server decision releases local pending guard and takes precedence over submitted snapshot", () => {
  const pending = verificationSchema.parse(batch);
  const approved = verificationSchema.parse({
    ...batch,
    status: "APPROVED",
    version: 2,
  });
  const submitted = new Map([[ids.sharing, pending]]);
  const current = ownSkillSchema.parse({
    ...ownSkill,
    verificationStatus: "VERIFIED",
    latestVerification: approved,
  });
  assert.deepEqual(withSubmittedVerification(current, submitted), current);
  assert.equal(submitted.size, 0);
  assert.equal(hasPendingVerification(current), false);
  assert.deepEqual(verificationItems([approved], pending), [approved]);
});

test("a reviewed idempotent submit response does not invent a pending status", () => {
  const approved = verificationSchema.parse({
    ...batch,
    status: "APPROVED",
    version: 2,
  });
  const current = ownSkillSchema.parse({
    ...ownSkill,
    verificationStatus: "VERIFIED",
    latestVerification: approved,
  });
  const submitted = new Map([[ids.sharing, approved]]);
  assert.deepEqual(withSubmittedVerification(current, submitted), current);
  assert.equal(hasPendingVerification(current), false);
});

test("confirmed submit patches owner caches and history without altering other sessions or pagination", () => {
  const client = new QueryClient();
  const scope = ["skills", 1, ids.user];
  const skill = ownSkillSchema.parse(ownSkill);
  const pending = verificationSchema.parse(batch);
  const other = { ...skill, id: ids.other };
  const pagination = { limit: 20, hasMore: true, nextCursor: "next" };
  const history = {
    pages: [
      { data: [pending], pagination },
      { data: [pending], pagination },
    ],
    pageParams: [undefined, "next"],
  };
  const list = {
    pages: [{ data: [skill, other], pagination }],
    pageParams: [undefined],
  };
  const submitted = new Map([[ids.sharing, pending]]);
  client.setQueryData([...scope, "detail", ids.sharing], skill);
  client.setQueryData([...scope, "own", false, "ALL"], list);
  client.setQueryData([...scope, "own", false, "PENDING"], {
    ...list,
    pages: [{ data: [], pagination }],
  });
  client.setQueryData([...scope, "history", ids.sharing], history);
  client.setQueryData(["skills", 2, "other", "own", false, "ALL"], list);
  recordVerificationQueries(client, scope, pending, submitted);
  assert.equal(
    client.getQueryData<typeof skill>([...scope, "detail", ids.sharing])
      ?.verificationStatus,
    "PENDING",
  );
  const saved = client.getQueryData<typeof history>([
    ...scope,
    "history",
    ids.sharing,
  ])!;
  assert.deepEqual(
    saved.pages.map((page) => page.data.map((value) => value.id)),
    [[ids.verification], []],
  );
  assert.deepEqual(saved.pageParams, history.pageParams);
  assert.deepEqual(saved.pages[0]!.pagination, pagination);
  const savedList = client.getQueryData<typeof list>([
    ...scope,
    "own",
    false,
    "ALL",
  ])!;
  assert.equal(savedList.pages[0]!.data[0]!.verificationStatus, "PENDING");
  assert.deepEqual(savedList.pages[0]!.data[1], other);
  const waitingList = client.getQueryData<typeof list>([
    ...scope,
    "own",
    false,
    "PENDING",
  ])!;
  assert.equal(waitingList.pages[0]!.data[0]!.id, ids.sharing);
  assert.equal(waitingList.pages[0]!.data[0]!.verificationStatus, "PENDING");
  assert.deepEqual(waitingList.pages[0]!.pagination, pagination);
  assert.deepEqual(
    client.getQueryData(["skills", 2, "other", "own", false, "ALL"]),
    list,
  );
  client.clear();
});

test("an older submit replay cannot replace a decision already cached from the server", () => {
  const client = new QueryClient();
  const scope = ["skills", 1, ids.user];
  const pending = verificationSchema.parse(batch);
  const approved = verificationSchema.parse({
    ...batch,
    status: "APPROVED",
    version: 2,
  });
  const submitted = new Map([[ids.sharing, pending]]);
  const history = {
    pages: [
      {
        data: [approved],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      },
    ],
    pageParams: [undefined],
  };
  client.setQueryData([...scope, "history", ids.sharing], history);
  recordVerificationQueries(client, scope, pending, submitted);
  assert.equal(submitted.size, 0);
  assert.equal(
    client.getQueryData<typeof history>([...scope, "history", ids.sharing])
      ?.pages[0]?.data[0]?.status,
    "APPROVED",
  );
  assert.equal(
    client.getQueryData<ReturnType<typeof verificationSchema.parse>>([
      ...scope,
      "verification",
      ids.sharing,
      ids.verification,
    ])?.status,
    "APPROVED",
  );
  client.clear();
});
