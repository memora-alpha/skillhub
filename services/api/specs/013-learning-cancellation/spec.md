# Cancellation for makeup and early termination

Source: SRS V1.6 §§18.20/18.38/18.40; implementation authorized 2026-11-05
after the cancellation/termination/dispute audit. Backend only.

The [per-session Credit amendment](session-credit-amendment.md), authorized
2026-11-06 for ONE_WAY and TWO_WAY, supersedes the original non-prorating rules
below for newly locked Holds. Historical Holds require review.

The later user-approved [Session policy amendment](session-policy-amendment.md)
adds personal makeup quotas shared across both directions, ordinary reschedule limits and explicit
bilateral immediate settlement. It takes precedence for those rules.

## Session cancellation

A participant requests cancellation of the exact upcoming occurrence with a
reason, explicit-zone `expectedStartAt` and `Idempotency-Key`. The other
participant accepts/rejects; the requester may withdraw before execution.
Only CONFIRMED/READY future occurrences qualify. An unanswered/rejected request
keeps the old schedule. A pending request expires at the earlier of the original
start and its configured request window.

Acceptance without a blocking report moves the SAME Session to MAKEUP_REQUIRED.
The promised count stays fixed; progress counts this Session once after makeup.
Store every request, policy snapshot and decision; the Session cancellation fields
are the latest summary. No automatic fault assignment, no-show reputation penalty
or Credit charge. Bilateral reschedule applies the new occurrence with existing
schedule history. MAKEUP_REQUIRED no longer reserves the abandoned time slot.

Intake/acceptance during a blocking report is allowed, but execution waits. A
30-second recovery worker revalidates the occurrence, deadline, Path and reports.
A changed/elapsed occurrence expires the old request. Expired makeup creates the
existing system case. Staff may use `cancellationMakeupRuling: EXTEND | COMPLETE`
to resolve it even when there was no attendance outcome. It never fabricates one.

## Agreement-wide termination

Both ONE_WAY and TWO_WAY have one termination request per agreement; TWO_WAY
execution covers both plans. Participant acceptance means ACCEPTED, not executed.
Partner rejection routes to STAFF_REVIEW; either participant may escalate an open
request. The requester may withdraw. Unresolved requests expire after the
configured operational window (default 72h). Expiry/withdrawal do not move money.
Schedules remain effective until a final decision; open, unexpired termination
requests hold final settlement.

Staff/Admin with `report:moderate` can read the review queue/details and reject.
Execution additionally requires ADMIN, `credit:adjust`, `dispute:override`, an
independent reviewer, a reason, the current execution digest, and an exact match
to `learningPath.changeRequests.terminationPolicyReference`. This defaults to null:
G05 remains CLOSED TO EXECUTION until the PO-approved policy is referenced via
the audited configuration update API. An arbitrary participant instruction cannot
activate it. No financial approval/config is performed by this implementation.

The Admin instruction allocates EACH existing Held amount into refund to its
owner + payment to the counterparty + platform fee. All values are exact Credit
strings and must sum to that allocation's full remaining Held. No inferred 96/4,
per-session prorating, Available-funded teacher penalty, debt or cash refund.
Actual partial-work prices, liability/free-cancellation thresholds, fee/penalty
amounts and shortages remain business-policy decisions.

Execution rereads the complete snapshot and blocks on any unresolved blocking
case. ONGOING, AWAITING_CONFIRMATION, unresolved NO_SHOW/DISPUTED and unruled past
CONFIRMED/READY sessions need their existing ruling first. COMPLETED history is
preserved; the Session owner cancels future/makeup obligations. The Credit owner
updates original source lots, Held allocations, wallets and immutable ledger.
Path becomes CANCELLED; a Request source becomes CLOSED without a completed
settlement timestamp or completion rewards. State, instruction, audit and outbox
commit together. Retry returns the same operation; a different instruction conflicts.

Post-termination reports may still be recorded, but cannot reopen the Path or
block a final settlement that will never run. Existing post-settlement dispute
adjustments remain the route for already-settled agreements, outside this flow.

## Financial and concurrency invariants

- Stable lock order: participant Users -> source Request when needed -> Path ->
  Session IDs -> sorted wallet IDs. Reports/normal settlement share the Path lock.
- One active request per target plus a permanent request command digest/key.
- One termination operation per locked Path version; each operation/beneficiary
  may receive one CreditLot (supports both TWO_WAY recipients).
- For each original Hold, refund + counterparty payment + fee = remaining Held.
  No allocation, wallet or lot becomes negative; no untracked source is invented.
- Terminal request evidence is immutable, with audit/outbox on every transition.
- No release/relock: retain the original allocation and all completed history.

## Settlement visibility

Participant status reads derive live blockers and expose a safe diagnostic
snapshot: NOT_LOCKED, WAITING_SESSIONS, WAITING_TERMINATION, WAITING_DISPUTE,
WAITING_DISPUTE_WINDOW, READY, RETRYING, NEEDS_REVIEW, SETTLED, TERMINATED.
They include `reasonCode`, `nextAction`, `lastCheckedAt`, `attemptCount`,
`retryable` and `settledAt`. No raw database/provider exception is published.
Diagnostics persist in a new transaction after financial commit/rollback.
Transient recovery backs off from 30s to 5min; configuration/data findings retry
every 5min after operator repair. A diagnostic-write failure never changes a
committed financial outcome.
