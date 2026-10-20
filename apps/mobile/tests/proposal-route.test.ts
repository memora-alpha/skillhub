import assert from "node:assert/strict";
import test from "node:test";
import {
  proposalId,
  proposalSource,
  proposalListFilter,
} from "../src/features/proposals/utils/proposal-route";
import { fixtureId } from "./fixtures/learning-requests-data";
test("proposal source accepts only a real request or a public Sharing Skill with its owner", () => {
  assert.deepEqual(proposalSource({ requestId: fixtureId(200) }), {
    requestId: fixtureId(200),
  });
  assert.deepEqual(
    proposalSource({ userId: fixtureId(2), sharingSkillId: fixtureId(300) }),
    { userId: fixtureId(2), sharingSkillId: fixtureId(300) },
  );
});
test("invalid, duplicate and mixed proposal sources cannot open a send form", () => {
  for (const params of [
    {},
    { userId: fixtureId(2) },
    { sharingSkillId: fixtureId(300) },
    { requestId: "demo-request" },
    { requestId: [fixtureId(200)] },
    { userId: [fixtureId(2)], sharingSkillId: fixtureId(300) },
    {
      requestId: fixtureId(200),
      userId: fixtureId(2),
      sharingSkillId: fixtureId(300),
    },
  ])
    assert.equal(proposalSource(params), null);
});
test("old preview metadata never becomes proposal API input", () => {
  assert.deepEqual(
    proposalSource({
      requestId: fixtureId(200),
      mode: "mock-request",
      previewTitle: "Old title",
      credit: "50",
    }),
    { requestId: fixtureId(200) },
  );
  assert.equal(proposalId("DX-2410"), null);
  assert.equal(proposalId([fixtureId(500)]), null);
  assert.equal(proposalId(fixtureId(500)), fixtureId(500));
});
test("proposal filters use only BE direction/status and an owner request identifier", () => {
  assert.equal(proposalListFilter({})?.direction, "all");
  assert.equal(proposalListFilter({ tab: "all" })?.direction, "all");
  assert.equal(
    proposalListFilter({ learningRequestId: fixtureId(200) })?.direction,
    "received",
  );
  assert.equal(
    proposalListFilter({ tab: "sent", status: "ACCEPTED" })?.status,
    "ACCEPTED",
  );
  assert.equal(
    proposalListFilter({ tab: "received", learningRequestId: fixtureId(200) })
      ?.learningRequestId,
    fixtureId(200),
  );
  for (const params of [
    { tab: "closed" },
    { tab: "discussing" },
    { status: "CONFIRMED" },
    { tab: ["sent", "received"] },
    { learningRequestId: "demo-request" },
    { tab: "sent", learningRequestId: fixtureId(200) },
    { tab: "all", learningRequestId: fixtureId(200) },
  ])
    assert.equal(proposalListFilter(params), null);
});

const requestId = fixtureId(100);
const userId = fixtureId(2);
const sharingSkillId = fixtureId(300);

test("request proposal entry forwards real IDs and strips route-supplied preview or private data", () => {
  assert.deepEqual(
    proposalSource({
      requestId,
      userId,
      previewTitle: "Mẫu cũ",
      proposedCredit: "900",
      privateEvidence: "secret",
    }),
    { requestId, userId },
  );
  assert.deepEqual(proposalSource({ requestId }), { requestId });
});

test("direct proposal entry needs both target UUIDs and rejects demo, duplicate or mixed route sources", () => {
  assert.deepEqual(proposalSource({ userId, sharingSkillId }), {
    userId,
    sharingSkillId,
  });
  for (const value of [
    { userId },
    { sharingSkillId },
    { userId: "demo-mentor-an", sharingSkillId },
    { requestId: [requestId, fixtureId(101)] },
    { userId, sharingSkillId: [sharingSkillId] },
    { requestId, userId, sharingSkillId },
    { requestId: "preview-request" },
    {},
  ])
    assert.equal(proposalSource(value), null);
});

test("proposal identity and request list filters keep their API direction constraints", () => {
  assert.equal(proposalId(requestId), requestId);
  assert.equal(proposalId([requestId]), null);
  assert.equal(proposalId("demo-proposal"), null);
  assert.deepEqual(proposalListFilter({ learningRequestId: requestId }), {
    learningRequestId: requestId,
    direction: "received",
  });
  assert.equal(
    proposalListFilter({ learningRequestId: requestId, tab: "sent" }),
    null,
  );
  assert.equal(proposalListFilter({ status: "invalid" }), null);
});
