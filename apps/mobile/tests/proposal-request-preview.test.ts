import assert from "node:assert/strict";
import test from "node:test";
import { readRequestProposalPreview } from "../src/features/proposals/utils/request-proposal-preview";
import { fixtureId } from "./fixtures/learning-requests-data";

const params = {
  mode: "mock-request",
  requestId: fixtureId(100),
  previewTitle: "Muốn học SQL để làm dự án",
  previewOwnerId: fixtureId(2),
  previewOwnerName: "Người học B",
  previewSkillName: "SQL",
};

test("mock preview preserves public context but isolates local request/party identifiers", () => {
  const preview = readRequestProposalPreview({
    ...params,
    proposedCredit: "900",
    verified: true,
    privateEvidence: "secret",
  });
  assert.ok(preview);
  assert.equal(preview.sourceRequestId, params.requestId);
  assert.equal(preview.title, params.previewTitle);
  assert.equal(preview.user, params.previewOwnerName);
  assert.equal(preview.id, `preview-request:${params.requestId}`);
  assert.equal(preview.userId, `preview-user:${params.previewOwnerId}`);
  assert.equal(preview.teachingSkills[0]?.name, "SQL");
  assert.equal(preview.teachingSkills[0]?.verified, false);
  assert.equal("privateEvidence" in preview, false);
  assert.equal("proposedCredit" in preview, false);
});

test("bare real IDs, duplicate route params, incomplete and malformed previews do not create mock targets", () => {
  for (const value of [
    { requestId: params.requestId },
    { ...params, mode: "real" },
    { ...params, previewOwnerId: "sample-name" },
    { ...params, requestId: [params.requestId, fixtureId(101)] },
    { ...params, previewTitle: "" },
    { ...params, previewSkillName: undefined },
  ])
    assert.equal(readRequestProposalPreview(value), null);
});

test("reopening the same request reuses local preview identity; distinct requests remain distinct", () => {
  const first = readRequestProposalPreview(params)!;
  const reopened = readRequestProposalPreview({
    ...params,
    previewTitle: "Tiêu đề mới",
  })!;
  assert.equal(reopened.id, first.id);
  assert.equal(reopened.userId, first.userId);
  assert.notEqual(
    readRequestProposalPreview({ ...params, requestId: fixtureId(101) })?.id,
    first.id,
  );
});
