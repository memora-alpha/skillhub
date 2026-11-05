# Tasks

- [x] Inspect source/SRS, create focused branch and record policy gates.
- [x] Persist request identity, occurrence/policy snapshots and immutable terminal history.
- [x] Implement bilateral cancellation, withdrawal/expiry and same-Session makeup.
- [x] Recover deferred cancellation after report closure and resolve overdue cancellation makeup.
- [x] Implement termination intake, responses, escalation and Staff review queue.
- [x] Implement gated Admin financial execution with exact per-Hold allocation and source lots.
- [x] Close source Request atomically and update read-only reconciliation evidence.
- [x] Guard settlement/terminal states against pending requests, disputes and delayed events.
- [x] Persist safe settlement diagnostics after rollback, expose status and bounded backoff.
- [x] Deliver both-participant notifications through the outbox.
- [x] Final focused lint/types/build, HTTP and affected regressions.
- [x] Final real PostgreSQL migration/concurrency/rollback/financial checks.
- [x] Record final verification evidence and Constitution Check.

Not implementation tasks: PO policy approval, production migration/activation,
mobile integration, release/relock and post-settlement reversal policy.

## Session policy amendment 2026-11-05

The [amendment plan and completed tasks](session-policy-amendment.md) cover the
subsequently approved makeup/reschedule limits and immediate settlement consent.
Final local validation: 139 service/HTTP regressions plus 18 PostgreSQL/schema
checks, no failures/skips; API lint, typecheck and build passed. Production rollout
and frontend/mobile integration remain outside this implementation.
