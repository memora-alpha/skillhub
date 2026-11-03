# Session no-show implementation evidence

Plan: `services/api/specs/012-session-no-show/plan.md` (2026-10-29).
Execution: Superpowers executing-plans with TDD; Ponytail full.
Baseline revision: `e6be94b786309e479caaad9a6ee7f454bfafc3ea`.
User authorized implementation; no commit, push or deployment authorized.

## Decisions and preflight

- Ruling: Continue in the existing `fix/session-livekit` checkout: the new spec/plan are untracked user artifacts in this checkout and this work extends its session scope. Preserve them; do not create a worktree or commit.
- Ruling: Use `determinedAt + confirmWindowHours` for confirmation deadlines, matching spec §6, the migration safeguard and the implementation plan; this preserves the full confirmation window for legacy sessions.
- Ruling: Staff ruling is `COMPLETE`, matching the actionable rules in spec §9.2 and the plan; `OVERTURNED` is the resulting outcome status.
- Ruling: Missing join window yields UNVERIFIABLE after the data-settle delay, per spec §4 and plan global constraints; the contradictory sentence in §12 does not override this explicit case.
- Preflight: Tasks 1 → 3/4/6/8/10 share the exact attendance policy shape and snapshot. Task 2 → 4–13 share nullable session deadlines, outcome/interval/excuse delegates and nullable report reporter. Task 3 → 5/6/7/8 share interval union and verdict types. Task 4 → 5/6/8 share Path → Session locking and participant SID. Task 6 → 7/8/9/10 share transitions/outcome events. Task 8 → 9/10/11/12 share finalization and makeup deadlines. No incompatible interface found; final integration checks remain required.

## Task ledger

Tasks 1–13 implemented and verified. Commit/push/deploy and runtime migration/config seed were not requested and remain rollout actions. Historical RED/GREEN evidence follows.

- Baseline: `pnpm --filter api test:learning-sessions`: 22/22 passed. Corepack required network access to download the pinned pnpm; retry succeeded.
- Task 1 RED: configuration test fails because the attendance definition is absent.

- Task 1 GREEN: attendance configuration test and existing key whitelist pass; updated the approved-key whitelist to include the new key.
- Task 2: generated schema validated; migration generated offline using Prisma schema diff to avoid touching an unspecified dev database. PostgreSQL application remains pending.
- Task 3 RED: attendance policy import missing as expected.
- Task 4 RED: first token issuance timestamp assertion fails before implementation.
- Task 2 Ruling: nullable reporter affects emitCaseUpdated immediately; moved its signature change from Task 12 into Task 2 so the schema change can typecheck.

- Tasks 3/4 GREEN: 5 policy tests and token stamp test pass; Task 5 RED: zero intervals instead of two, room-finished interval missing.

- Task 5 GREEN: 9/9 lifecycle tests pass, including duplicate/reordered webhooks and room_finished.
- Task 6 RED: missing outcome and ensureDetermined; early confirm incorrectly succeeds.

- Task 6 GREEN: complete Session suite 35/35 passed, including outcome idempotency, absence gating and missing observation.

- Task 7 RED: attendance.state missing on detail. Implemented projection and updated the previous contract assertions.

- Task 7 GREEN: Session suite 37/37 passed with the new attendance/deadlines/excuse/allowedActions contract.

- Task 8 RED: SessionOutcomeService module absent; tests now cover timeout, Staff escalation, one penalty, makeup deadline and heartbeat.

- Task 8 GREEN: timeout, Staff escalation, no-show penalty, makeup and heartbeat tests passed. Task 9 RED: submitExcuse missing.

- Task 9 GREEN: Session suite 44/44 passed, including excuse owner/decision authorization and expiry.

- Task 10 RED: report leaves outcome PROVISIONAL and system case can be rejected without ruling.
- Task 10 Ruling: createSessionReport now uses the shared Path → Session lock before reading mutable state, so it serializes with determination/finalization.

- Task 10 GREEN: Session suite 47/47 passed with report freezing, release and required system-case ruling.
- Task 11 RED: MAKEUP_REQUIRED reschedule rejected as SESSION_CANNOT_BE_RESCHEDULED.
- Task 13 preparation: TEST_DATABASE_URL absent; isolated integration schemas will use the existing local Compose PostgreSQL on port 5433, using the repository test harness. No dev/runtime database migration or seed will be run.

- Task 12 RED: SessionNotificationHandler module absent. Handler now routes six outbox event types and report notifications accept null system reporters.

- Task 11 GREEN: makeup reschedule test passes; new occurrence has reset tokens/deadlines and a distinct second no-show outcome.
- Task 7 regression adaptation: replaced the old incomplete BigInt detail stub with the existing full fake-DB fixture and outcome projection assertion.

## Whole-change review and fixes

Fresh-context Superpowers reviewer found eight Important issues and two Minor issues. All were accepted; focused RED tests reproduced authorization-before-determination, pre-determination report freezing, saved makeup/report policy, terminal heartbeat, heartbeat recovery, Staff replay, duplicate generic NO_SHOW penalties, legacy early-token migration, system audit and path action eligibility.

Rulings: persisted outcome policy/finalizesAt govern existing occurrences even without current configuration; only legacy sessions without an outcome read the current dispute default. Generic NO_SHOW violations on attendance-managed cases are rejected in favor of the occurrence ruling. Closed-case retries return the existing same terminal result and apply no further effects. Heartbeat-closed intervals can reopen only from an active provider observation, not a delayed joined webhook. Legacy future sessions with room_name are conservatively backfilled because old token issuance provisions that name. Outcome service no longer injects configuration/provider services because it now consumes the saved occurrence policy.

## Final verification — 2026-11-03

- Independent review: approved after the final generic-NO_SHOW guard was made unconditional for Session reports, including reports opened before determination. No Critical/Important finding remains open.
- pnpm --filter api lint: exit 0, zero warnings.
- pnpm --filter api check-types: exit 0 (Prisma Client 7.8.0 generation + TypeScript).
- pnpm --filter api build: exit 0 (prebuild Prisma generation + Nest build).
- Combined affected suite: 141 tests passed, 0 failed, 0 skipped. Includes Session (60), bigint responses (3), learning-platform phase1–4 and learning-request lifecycle-flow (55), and configuration/time/provider/log tests (23). TEST_POSTGRES_URL enabled the real PostgreSQL UTC check.
- PostgreSQL run: 12 business integration tests plus 4 timezone/connection checks passed (16 total, zero failures/skips). Local Compose PostgreSQL port 5433; each business fixture creates, migrates and removes its own UUID schema. No runtime schema migration or seed was run.
- Expanded Session persistence test exercises conservative legacy early-token backfill, concurrent determination, unique outcomes, receipt rollback, report freeze, concurrent Staff UPHOLD with one -8, closed-case replay, makeup reschedule/reset, fresh occurrence completion and exactly-once final settlement.
- The first resumed suite exposed a date-bound JWT fixture (02 November expiry); it was corrected to use current wall time for SDK verification. An earlier test launch before Nest finished also failed on missing dist imports; after waiting for build, the final run above passed. Neither transient failure was hidden.
- HTTP checks include membership, authentication, reason trimming/minimum length, boolean validation, submitting an excuse and the opposite participant accepting it.
- System escalation now projects DISPUTED/STAFF_REVIEW; Staff COMPLETE normalizes FINAL/OVERTURNED as applicable. Both behavior checks passed.

## Constitution check

| Principle                          | Evidence                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend/module scope               | Pass: all deliverable changes remain in services/api; no frontend or shared-package changes.                                                        |
| Relational authority and atomicity | Pass: evidence/outcomes/cases/reputation/outbox share PostgreSQL transactions; actual DB rollback and contention suites passed.                     |
| Authorization and validation       | Pass: participant authorization precedes lazy determination, Staff grants remain enforced, DTO and HTTP guards passed.                              |
| API representation                 | Pass: seconds are decimal strings, dates UTC, nullable system reporters handled; breaking mobile contract documented in contracts.md and API guide. |
| Verification                       | Pass: lint, typecheck, build, 141-test suite and isolated PostgreSQL suites above. Production Cloud smoke remains outside local evidence.           |
| Ownership boundaries               | Pass: reused existing application helpers/services and Credit ports; no module DI cycle or new dependency.                                          |
| Reliable async processing          | Pass: occurrence dedupe, Path → Session locking, receipt rollback, stale-observation and Staff replay guards tested.                                |

## Rollout and limits

Apply migration 20261029000000_session_no_show with the API code, seed session.attendancePolicy using the existing configuration seed, and coordinate the breaking attendance projection with mobile clients. These actions were not executed on a runtime database. No commit or push was created.

Part C Credit penalty/refund ratios, frontend UI, recording/egress and production LiveKit Cloud smoke remain outside this scope. Finalization uses the plan's bounded queries (up to limit per due category/sweep); cursor pagination for a larger persistent due backlog remains the documented Ponytail ceiling.
