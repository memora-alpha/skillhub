import assert from "node:assert/strict";
import test from "node:test";
import {
  proposalId,
  proposalSource,
  proposalListFilter,
} from "../src/features/proposals/utils/proposal-route";
import { fixtureId } from "./fixtures/learning-requests-data";

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
