# HTTP contract (all under /api/v1)

All routes require Bearer authentication. Commands validate membership or explicit
review powers; UUID parameters and unknown body fields are rejected. Credit is
an exact decimal string, never a floating-point amount.

| Route                                                                   | Body / result                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| POST `/sessions/:sessionId/cancellation-requests`                       | Header `Idempotency-Key`; `{reason, expectedStartAt}` (timestamp with explicit zone) |
| GET `/sessions/:sessionId/cancellation-requests`                        | Latest 100 requests with decision and dispute blocker                                |
| POST `/sessions/:sessionId/cancellation-requests/:requestId/response`   | `{expectedVersion, accept, note?}`; only the partner                                 |
| POST `/sessions/:sessionId/cancellation-requests/:requestId/withdraw`   | `{expectedVersion}`; only requester, before execution                                |
| POST `/learning-paths/:pathId/termination-requests`                     | Header `Idempotency-Key`; `{reason}`                                                 |
| GET `/learning-paths/:pathId/termination-requests`                      | Latest 100 requests; exposes `awaitingPolicy`/`blockedByDispute`                     |
| POST `/learning-paths/:pathId/termination-requests/:requestId/response` | `{expectedVersion, accept, note?}`                                                   |
| POST `/learning-paths/:pathId/termination-requests/:requestId/withdraw` | `{expectedVersion}`                                                                  |
| POST `/learning-paths/:pathId/termination-requests/:requestId/escalate` | `{expectedVersion, reason}`                                                          |
| GET `/learning-changes/review-queue?limit=100&after=<uuid>`             | Staff/Admin `report:moderate`; `items`, `nextCursor`; UUID ascending                 |
| GET `/learning-paths/:pathId/termination-requests/:requestId/review`    | Staff/Admin; includes fresh execution digest and Held allocations                    |
| POST `/learning-paths/:pathId/termination-requests/:requestId/reject`   | Staff/Admin; `{expectedVersion, reason}`                                             |
| POST `/learning-paths/:pathId/termination-requests/:requestId/execute`  | Independent Admin with all review/adjust/override powers; approved policy required   |
| GET `/learning-paths/:pathId/settlement-status`                         | Participant; live blockers and safe retry/review diagnostics                         |

Execution body:

```json
{
  "expectedVersion": 2,
  "expectedExecutionDigest": "<fresh digest from review>",
  "policyReference": "<approved reference configured by operator>",
  "reason": "<reasoned case decision>",
  "allocations": [
    {
      "allocationId": "<Held allocation UUID>",
      "refund": "<Credit returned to the original payer>",
      "counterpartyPayment": "<Credit paid from this Hold to the other participant>",
      "platformFee": "<Credit retained as fee>"
    }
  ]
}
```

These are explicit decided amounts under the referenced policy; this endpoint is
not a quote engine. Never derive them in the client from completed/total sessions.
Each allocation must be present once and fully accounted for. A new review is
required when progress/schedule/Hold/Path/policy changes. A blocking report always
prevents execution, even if the digest has not changed. No automatic execution
after case closure: Admin reviews again. Accepted session cancellations recover
automatically only while their original occurrence/deadline still qualify.

Report resolution additionally accepts `cancellationMakeupRuling: "EXTEND" |
"COMPLETE"` for a makeup originating from cancellation. Do not combine it with
`noShowRuling`. It applies only on `resolve` with the normal report permissions,
assignment and mandatory resolution note.

Notable 409 codes: CHANGE_REQUEST_ALREADY_PENDING, CHANGE_REQUEST_KEY_CONFLICT,
STALE_SESSION_OCCURRENCE, STALE_CHANGE_REQUEST_VERSION, CHANGE_REQUEST_EXPIRED,
TERMINATION_POLICY_NOT_APPROVED, TERMINATION_BLOCKED_BY_DISPUTE,
STALE_TERMINATION_EXECUTION, TERMINATION_SESSION_RULING_REQUIRED,
TERMINATION_ALLOCATION_MISMATCH, TERMINATION_DECISION_CONFLICT,
SETTLEMENT_BLOCKED_BY_TERMINATION. Missing idempotency key is 400.

`learning-path.change.updated` uses durable outbox delivery to both participants,
with generic notification copy and only Path/request IDs, never the private reason.
No mobile screens were changed; integrate these APIs in a separately authorized task.
