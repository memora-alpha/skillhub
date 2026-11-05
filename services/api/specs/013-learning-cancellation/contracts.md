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

## Session policy amendment 2026-11-05

Session detail now includes `originalStartAt`, `rescheduleCount`, `makeupCount`, and
`makeupQuota: {limit, used, remaining, reason}`. The list also returns the three
Session fields. `makeupCount` records granted opportunities, not HTTP attempts.
The quota is shared by cancellation/absence makeup within each locked plan/teaching
direction: `max(1, floor(totalSessions / 5))`. Each original Session gets at most
one opportunity. Expired requests, repeated responses and makeup booking do not
consume ordinary reschedule attempts.

Ordinary reschedules apply at most three changed, bilaterally confirmed versions
per Session. A new interval must fit between its neighboring Sessions in the same
plan. The last Session can start at most 48 hours after `originalStartAt`; equality
is allowed. Both intake and final confirmation recheck these rules and the existing
60-minute cutoff. Reconfirming the applied version returns its LOCKED result
without counting it again. Makeup booking retains its configured deadline and is
separate from these ordinary reschedule limits.

New 409 codes: `SESSION_MAKEUP_LIMIT_REACHED`, `PLAN_MAKEUP_LIMIT_REACHED`,
`SESSION_RESCHEDULE_LIMIT_REACHED`, `RESCHEDULE_SESSION_ORDER_VIOLATION`,
`LAST_SESSION_RESCHEDULE_WINDOW_EXCEEDED`. A cancellation accepted while blocked
by a dispute may expire on recovery if another grant has exhausted its quota.
Automatic no-show quota exhaustion opens a blocking `MAKEUP_LIMIT_REACHED` Staff
case. A Staff extension of an existing booking deadline retains the same grant;
it does not authorize a second makeup occurrence.

### Immediate final settlement

`POST /sessions/paths/:pathId/settlement-consent`, Bearer, body:

```json
{ "expectedVersion": 1 }
```

`expectedVersion` is the locked agreement version returned by settlement-status.
Only a participant can consent for themselves, after every Session is COMPLETED.
This decision is separate from `confirm-completion`. Replays retain the original
consent time. Both explicit consents bypass only the 48-hour report window;
blocking disputes, termination requests, fee/Hold/provenance and source lifecycle
invariants still apply. Without both consents, existing expiry settlement remains.
New blocking reports clear both consents; new approvals are needed after case
resolution if the window is still open. A report recorded after settlement retains
the existing nonblocking behavior; there is no automatic ledger reversal.

200 response data: `{pathId, approvedAt, bothApproved, settlement: {outcome, errorCode?}}`.
`outcome` is `SETTLED`, `WAITING`, `RETRYING` or `NEEDS_REVIEW`. Consent commits with
its audit and durable retry outbox before the financial transaction. A financial
failure therefore retains consent for worker recovery and never exposes a raw
exception through this response. `POST /sessions/paths/:pathId/settlement` remains
a retry command and does not implicitly grant consent.

Settlement-status adds `pathVersion`, `autoSettlementAt` (UTC; null while not ready)
and `immediateSettlement: {ownApprovedAt, partnerApprovedAt, canApprove}`. While the
window is open, `nextAction` is `APPROVE_IMMEDIATE_SETTLEMENT_OR_WAIT` or
`WAIT_FOR_PARTNER_OR_DEADLINE`. Client code must use these fields, not treat Session
completion as financial consent or calculate monetary outcomes.
