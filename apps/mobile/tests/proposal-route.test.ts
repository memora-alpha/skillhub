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
