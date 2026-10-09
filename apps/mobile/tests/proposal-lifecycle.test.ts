import assert from "node:assert/strict";
import test from "node:test";
import type {
  DemoProposal,
  ProposalStatus,
} from "../src/features/proposals/mocks/proposals";
import {
  proposalFormSchema,
  rejectionFormSchema,
} from "../src/features/proposals/schemas/proposal-form";
import {
  decidePendingProposal,
  updatePendingProposal,
} from "../src/features/proposals/utils/proposal-transitions";

const fixture: DemoProposal = {
  id: "proposal-1",
  direction: "sent",
  sourceType: "LEARNING_REQUEST",
  requestId: "request-1",
  requestTitle: "Học React",
  partnerId: "partner-1",
  partner: "Người học",
  skill: "React",
  message: "Cùng thực hành React qua một dự án nhỏ.",
  credit: "50",
  sessions: 4,
  schedule: "Cuối tuần",
  time: "Dữ liệu mẫu",
  status: "PENDING",
};
const changes = {
  message: "  Nội dung đã cập nhật cho đề xuất.  ",
  credit: "45.50",
  sessions: 6,
  schedule: " Tối Thứ 7 ",
};

test("update preserves identity and pending state, normalizes suggestions", () => {
  const unrelated = { ...fixture, id: "other" };
  const result = updatePendingProposal(
    [fixture, unrelated],
    fixture.id,
    changes,
  )!;
  assert.equal(result[0]!.id, fixture.id);
  assert.equal(result[0]!.requestId, fixture.requestId);
  assert.equal(result[0]!.partnerId, fixture.partnerId);
  assert.equal(result[0]!.status, "PENDING");
  assert.equal(result[0]!.message, changes.message.trim());
  assert.equal(result[0]!.schedule, "Tối Thứ 7");
  assert.equal(result[0]!.sessions, 6);
  assert.equal(result[1], unrelated);
  assert.equal(fixture.credit, "50");
});

test("update rejects received, missing, accepted and all closed proposals", () => {
  assert.equal(
    updatePendingProposal(
      [{ ...fixture, direction: "received" }],
      fixture.id,
      changes,
    ),
    null,
  );
  assert.equal(updatePendingProposal([fixture], "missing", changes), null);
  for (const status of [
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
    "EXPIRED",
  ] as ProposalStatus[]) {
    assert.equal(
      updatePendingProposal([{ ...fixture, status }], fixture.id, changes),
      null,
    );
  }
  assert.equal(
    updatePendingProposal([fixture], fixture.id, { ...changes, sessions: 1.5 }),
    null,
  );
  assert.equal(
    updatePendingProposal([fixture], fixture.id, {
      ...changes,
      message: "short",
    }),
    null,
  );
});

test("only sender can withdraw and only receiver can accept/reject", () => {
  assert.equal(decidePendingProposal([fixture], fixture.id, "ACCEPTED"), null);
  assert.equal(decidePendingProposal([fixture], fixture.id, "REJECTED"), null);
  assert.equal(
    decidePendingProposal(
      [{ ...fixture, direction: "received" }],
      fixture.id,
      "WITHDRAWN",
    ),
    null,
  );
  const result = decidePendingProposal([fixture], fixture.id, "WITHDRAWN")!;
  assert.equal(result[0]!.status, "WITHDRAWN");
  assert.equal(decidePendingProposal(result, fixture.id, "WITHDRAWN"), null);
  assert.equal(updatePendingProposal(result, fixture.id, changes), null);
});

test("accept rejects another connection for same request but permits an independent direct invitation", () => {
  const received = { ...fixture, direction: "received" as const };
  const accepted = {
    ...received,
    id: "already-accepted",
    status: "ACCEPTED" as const,
  };
  assert.equal(
    decidePendingProposal([received, accepted], received.id, "ACCEPTED"),
    null,
  );
  const direct = {
    ...received,
    sourceType: "DIRECT_SEARCH" as const,
    requestId: undefined,
  };
  assert.equal(
    decidePendingProposal([direct, accepted], direct.id, "ACCEPTED")![0]!
      .status,
    "ACCEPTED",
  );
});

test("reject stores local reason and preserves every other proposal", () => {
  const received = { ...fixture, direction: "received" as const };
  const other = { ...received, id: "other" };
  const result = decidePendingProposal(
    [received, other],
    received.id,
    "REJECTED",
    "  Khung giờ chưa phù hợp  ",
  )!;
  assert.equal(result[0]!.localDecisionNote, "Khung giờ chưa phù hợp");
  assert.equal(result[0]!.status, "REJECTED");
  assert.equal(result[1], other);
});

test("form rejects invalid decimal precision, unsafe or fractional session counts and message bounds", () => {
  const valid = { ...changes, sessions: "6" };
  assert.equal(proposalFormSchema.safeParse(valid).success, true);
  for (const credit of ["0", "-1", "Infinity", "1.234", "10000000000", "1e2"]) {
    assert.equal(
      proposalFormSchema.safeParse({ ...valid, credit }).success,
      false,
      credit,
    );
  }
  for (const sessions of ["0", "-1", "1.5", "9007199254740992"]) {
    assert.equal(
      proposalFormSchema.safeParse({ ...valid, sessions }).success,
      false,
      sessions,
    );
  }
  assert.equal(
    proposalFormSchema.safeParse({ ...valid, message: "a".repeat(1001) })
      .success,
    false,
  );
  assert.equal(rejectionFormSchema.safeParse({ note: "  " }).success, false);
  assert.equal(
    rejectionFormSchema.safeParse({ note: "Chưa phù hợp" }).success,
    true,
  );
});
