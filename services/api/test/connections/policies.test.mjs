import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProposal,
  normalizeMessage,
  connectionSettings,
} from "../../dist/modules/proposals/domain/connection-policy.js";
import {
  encodeCursor,
  decodeCursor,
} from "../../dist/modules/application-events/domain/event-cursor.js";

test("approved limits and exact hundredths without floating point", () => {
  const policy = connectionSettings({});
  assert.equal(policy.proposalTtlDays, 7);
  assert.equal(policy.filesPerMessage, 5);
  assert.equal(
    normalizeProposal(
      {
        message: "A valid invitation",
        exchangeTypeHint: "TWO_WAY",
        proposedCredit: "20.01",
      },
      policy,
    ).proposedCredit,
    2001n,
  );
  for (const proposedCredit of ["2e2", " 20", "20.001", "0", "-20"])
    assert.throws(() =>
      normalizeProposal(
        {
          message: "A valid invitation",
          exchangeTypeHint: "TWO_WAY",
          proposedCredit,
        },
        policy,
      ),
    );
  assert.throws(
    () =>
      normalizeProposal(
        { message: "A valid invitation", initialSessionCount: 2 },
        policy,
      ),
    /CONNECTION_POLICY_UNAVAILABLE/,
  );
});
test("message canonicalization and file count reject malformed commands", () => {
  assert.equal(
    normalizeMessage({ messageText: " <b>Hello</b> " }).messageText,
    "Hello",
  );
  assert.throws(() => normalizeMessage({ messageText: "  " }));
  assert.throws(() =>
    normalizeMessage({ attachmentFileIds: Array(6).fill("a") }),
  );
});
test("SSE cursor is signed, recipient-scoped and separate from message sequence", () => {
  const secret = "a".repeat(32),
    userId = "viewer",
    epoch = "epoch";
  const cursor = encodeCursor({ userId, epoch, sequence: 12n }, secret);
  assert.equal(decodeCursor(cursor, userId, epoch, secret), 12n);
  assert.throws(() => decodeCursor(cursor, "another", epoch, secret));
  assert.throws(() => decodeCursor(cursor + "x", userId, epoch, secret));
  assert.throws(() => decodeCursor(cursor, userId, "other", secret));
});
