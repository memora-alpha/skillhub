import assert from "node:assert/strict";
import test from "node:test";
import { readTeacherEligibility } from "../src/features/skills/utils/read-teacher-eligibility";
import { findPendingProposal } from "../src/features/proposals/api/proposal-preflight";
import type { Proposal } from "../src/features/proposals/api/proposals-api";
import { fixtureId } from "./fixtures/learning-requests-data";
const skill = {
  id: fixtureId(1),
  archivedAt: null,
  skill: { id: fixtureId(2), status: "ACTIVE" },
  verificationStatus: "UNVERIFIED",
};
const signal = () => new AbortController().signal;
test("teacher checks all pages and requires verified only when requested", async () => {
  const cursors: (string | undefined)[] = [];
  const read = async (cursor?: string) => {
    cursors.push(cursor);
    return {
      data: cursor
        ? [skill]
        : [{ ...skill, skill: { ...skill.skill, id: fixtureId(3) } }],
      pagination: { hasMore: !cursor, nextCursor: cursor ? null : "next" },
    };
  };
  assert.deepEqual(
    await readTeacherEligibility(
      read,
      skill.skill.id,
      false,
      signal(),
      () => {},
    ),
    { state: "eligible", sharingSkillId: skill.id },
  );
  assert.deepEqual(cursors, [undefined, "next"]);
  assert.equal(
    (
      await readTeacherEligibility(
        read,
        skill.skill.id,
        true,
        signal(),
        () => {},
      )
    ).state,
    "unverified",
  );
  assert.equal(
    (
      await readTeacherEligibility(
        async () => ({
          data: [{ ...skill, verificationStatus: "VERIFIED" }],
          pagination: { hasMore: false, nextCursor: null },
        }),
        skill.skill.id,
        true,
        signal(),
        () => {},
      )
    ).state,
    "eligible",
  );
});
test("archived/inactive or missing skills are ineligible; errors and stale sessions never become missing", async () => {
  const read = async () => ({
    data: [
      { ...skill, archivedAt: "2030-01-01T00:00:00Z" },
      { ...skill, skill: { ...skill.skill, status: "INACTIVE" } },
    ],
    pagination: { hasMore: false, nextCursor: null },
  });
  assert.equal(
    (
      await readTeacherEligibility(
        read,
        skill.skill.id,
        false,
        signal(),
        () => {},
      )
    ).state,
    "missing",
  );
  await assert.rejects(
    readTeacherEligibility(
      async () => {
        throw Error("offline");
      },
      skill.skill.id,
      false,
      signal(),
      () => {},
    ),
  );
  await assert.rejects(
    readTeacherEligibility(read, skill.skill.id, false, signal(), () => {
      throw Error("session expired");
    }),
  );
  await assert.rejects(
    readTeacherEligibility(
      async () => ({
        data: [],
        pagination: { hasMore: true, nextCursor: "same" },
      }),
      skill.skill.id,
      false,
      signal(),
      () => {},
    ),
  );
});
const proposal: Proposal = {
  id: fixtureId(10),
  sourceType: "LEARNING_REQUEST",
  learningRequestId: fixtureId(20),
  proposerId: fixtureId(1),
  recipientId: fixtureId(2),
  skillId: fixtureId(3),
  message: "Lời nhắn kiểm thử",
  status: "PENDING",
  version: 1,
  exchangeTypeHint: "TWO_WAY",
  proposedCredit: null,
  proposedDurationMinutes: null,
  initialSessionCount: null,
  candidateSlots: null,
  expiresAt: "2030-01-02T00:00:00Z",
  createdAt: "2030-01-01T00:00:00Z",
  updatedAt: "2030-01-01T00:00:00Z",
};
test("duplicate preflight checks later pages with exact Request or direct target scope", async () => {
  const target = {
    requestId: proposal.learningRequestId!,
    recipientId: proposal.recipientId,
    skillId: proposal.skillId,
  };
  const read = async (cursor?: string) => ({
    items: cursor
      ? [proposal]
      : [{ ...proposal, learningRequestId: fixtureId(21) }],
    nextCursor: cursor ? null : "later",
  });
  assert.deepEqual(await findPendingProposal(read, target), {
    id: proposal.id,
  });
  assert.equal(
    await findPendingProposal(
      async () => ({
        items: [{ ...proposal, status: "REJECTED" }],
        nextCursor: null,
      }),
      target,
    ),
    null,
  );
  const direct = {
    ...proposal,
    sourceType: "DIRECT_SEARCH" as const,
    learningRequestId: null,
  };
  assert.deepEqual(
    await findPendingProposal(
      async () => ({ items: [direct], nextCursor: null }),
      { recipientId: direct.recipientId, skillId: direct.skillId },
    ),
    { id: direct.id },
  );
  assert.equal(
    await findPendingProposal(
      async () => ({ items: [direct], nextCursor: null }),
      { recipientId: fixtureId(99), skillId: direct.skillId },
    ),
    null,
  );
  await assert.rejects(
    findPendingProposal(
      async () => ({ items: [], nextCursor: "same" }),
      target,
    ),
  );
});
