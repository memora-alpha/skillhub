# Session limits and early settlement amendment

Authorized by the user on 2026-11-05, including the proposed rounding and counting rules.
Backend only. Branch: `fix/session-policy-settlement`.

## Accepted behavior

- Reserve one makeup opportunity per original Session when bilateral cancellation/absence excuse is accepted, or an existing no-show ruling requires makeup. Cancellation adds no Credit/reputation penalty and never creates an extra promised Session.
- Share a quota of `max(1, floor(totalSessions / 5))` across cancellation and absence makeup within each locked plan/direction. TWO_WAY directions have independent quotas. Reservations remain consumed; retries do not consume more. Legacy over-limit history is retained and blocks new grants.
- Ordinary reschedules count only successful, changed, bilaterally applied occurrences, at most three per Session. Pending/rejected/no-op revisions and makeup booking do not count. Check at proposal and application under the Path lock.
- Preserve plan sequence: a new interval must fit between its neighboring Session intervals. The last ordinary Session may start at most 48 hours after its original locked start, never a rolling 48-hour extension. The existing 60-minute cutoff still applies. Makeup is a separate flow and retains its existing configured booking deadline; otherwise a no-show finalized after 48 hours could never receive its approved makeup.
- Once all Sessions are COMPLETED, each participant can explicitly approve immediate final settlement. Completion confirmation is not financial consent. Both consents bypass only the report window, never a blocking dispute, pending termination or financial invariant. Existing 48-hour expiry settlement continues without consent. New blocking reports clear both consents. Post-settlement reports retain the existing nonblocking behavior; no automatic ledger reversal.
- Quota exhaustion on automatic no-show finalization opens a Staff case instead of retrying forever or granting another makeup. Staff can resolve completion; another makeup grant is subject to the same limits. Extending the booking deadline of an already granted opportunity does not grant another occurrence.

## Persistence and transaction plan

Add Session `originalStartAt`, `rescheduleCount`, `makeupCount`; retain original history and backfill from the earliest schedule history. Backfill historical counts conservatively, without changing successful ledger rows or suppressing old makeup history. Store two participant consent timestamps on LearningPath. All writers serialize through existing sorted User -> Request (where applicable) -> Path -> Session locks. Consent and its audit/retry outbox commit together; financial settlement revalidates state in its own atomic transaction.

## Tasks

- [x] Add generated runtime schema, additive migration and backfill/immutability checks.
- [x] Enforce makeup quota across cancellation, excuses, automatic and Staff outcomes.
- [x] Enforce ordinary reschedule limits at intake and bilateral apply; expose counters.
- [x] Add explicit consent endpoint, audit, retry delivery and participant status projection.
- [x] Verify unit/HTTP regressions, migration and real PostgreSQL concurrency/rollback.
- [x] Update contracts, rollout instructions and final validation evidence.

## Constitution check

API scope and existing module ownership retained; PostgreSQL owns counters, consents and Credit.
Existing exact-money ledger, sorted locks, identity guards, audit and durable outbox are reused.
Local implementation checks Pass: API lint, typecheck, build, 139 service/HTTP regressions
and 18 isolated PostgreSQL/schema checks; zero failures/skips. See [validation](validation.md).
Audit/outbox rollback, plan-quota races, duplicate schedule confirmations and report/settlement
races were exercised on a dedicated PostgreSQL 18 test cluster. No constitutional exceptions.
Production migration/deployment, real frontend journeys and Sonar cloud analysis remain unverified.
