# Learning Path activity ordering

Date: 2026-11-11. Branch: `fix/learning-path-activity-order` from `dev` after PR #97.

## Scope and contract

Implement the requested `GET /api/v1/learning-paths/mine` order:
`lastActivityAt DESC, id DESC`, with the same keys in keyset filtering and cursor
encoding. Preserve participant scope, limit, title and overview hydration after
pagination. Add `lastActivityAt` to the response and OpenAPI. Mark the opaque
cursor `activity-v1`; reject legacy or wrong-viewer cursors with the existing
400 code so clients restart the list instead of mixing incompatible orderings.
No frontend/mobile/root package changes.

## Derived activity projection

PostgreSQL remains authoritative. Path-owned database triggers maintain the
projection atomically with actual business changes; no asynchronous chat/notification
delivery affects order. All source operations already acquire the Path lock
before changing plans/schedules, so the projection does not add a new lock order.
The timestamp uses `GREATEST(last_activity_at, clock_timestamp())` and never moves
backward. Column default initializes new paths.

| Source                                       | Included change                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| LearningPath                                 | Version, lock, status, completion, termination, settlement and participant settlement approvals change. |
| Current agreement version                    | New version or either participant confirmation changes.                                                 |
| LearningPlan                                 | Creation, current version or status changes.                                                            |
| Current LearningPlanVersion                  | Learner confirmation changes.                                                                           |
| ScheduleProposal                             | Creation, current/applied version or status changes.                                                    |
| Current ScheduleVersion for the current Path | Either participant confirmation changes.                                                                |

No-op/replayed confirmations do not change these fields. Exclude generic
`updatedAt`, fee pinning, read/overview operations, technical jobs, chat/SSE/outbox
delivery and attendance heartbeats. Session lifecycle and report decisions that
change Path status are covered by the Path trigger; isolated report message,
attendance or review content changes are outside this agreement/scheduling order.
Historical version confirmation changes do not reorder the current agreement.

Migration `20261111000000_learning_path_activity` adds the column, backfills from
recorded business timestamps, and adds both participant/activity/ID indexes.
Backfill considers Path lifecycle dates, agreement/plan/schedule version creation
and confirmation dates, and applied session schedule history for lock/reschedule. Generic
`updatedAt` and migration time are excluded. History without a dedicated source
timestamp cannot be recovered exactly. No historical event or fee value is invented.

Apply the migration before starting the new API. The old API tolerates the additive
column; deployment uses existing migration bootstrap. No new env or seed. The
migration runs atomically; its schema update/backfill/index creation locks relevant
tables during rollout, so use the normal deployment maintenance procedure.

## Constitution Check

| Principles                | Status / evidence                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 7: scope/ownership     | Pass for design: Path owns the derived projection and SQL maintenance; source owner writes are unchanged, no cross-store writes or new owner bypass.                       |
| 2, 3: authority/atomicity | Pass locally: rollback and monotonic timestamp verified on embedded PostgreSQL; existing Path-first locks unchanged. Multi-connection server verification remains pending. |
| 4: authorization          | Pass locally: viewer filters retained; cross-viewer/invalid/legacy cursor cases verified. No new private content.                                                          |
| 5: contracts/storage      | Pass locally: HTTP/Swagger include UTC activity; keyset order and indexes match; all 47 migrations apply on embedded PostgreSQL.                                           |
| 6: verification           | Pass locally: lint/types/build, 148 passing regression cases, embedded SQL behavior/history checks. See below for skipped server tests.                                    |
| 8: asynchronous behavior  | Not applicable to maintenance: the projection is synchronous; delivery/retry does not advance it.                                                                          |

No exceptions. SQL tests exercise backfill, every trigger branch, no-op reads and
replays, stale versions, technical updates, rollback and monotonic time. Embedded
PostgreSQL validation does not claim multi-connection server concurrency proof.

## Validation

Completed on 2026-11-11:

- API `lint`, `check-types` (including Prisma generation), and `build`: passed.
- Focused SQL fixture `verifyPathActivitySql` on temporary PGlite 0.3.14
  (embedded PostgreSQL, installed outside the repository): passed. Covers
  backfill excluding technical `updated_at`, all trigger branches, current/stale
  versions, actual confirmation/edits, unchanged updates/reads, lifecycle/settlement,
  rollback, monotonic time and both index definitions.
- All 47 repository migrations applied sequentially to a fresh embedded database:
  passed. This verifies the actual pre-existing table/column/trigger definitions,
  in addition to the fixture's focused SQL behavior.
- Node regression command from `services/api`, outside sandbox for HTTP localhost:

  ```text
  node --test --test-reporter=spec test/learning-path-read.test.mjs test/path-overview.test.mjs test/path-scheduling-schema.test.mjs test/learning-platform-audit.test.mjs test/learning-platform/phase*.test.mjs test/learning-platform/error-http.test.mjs test/learning-platform/schedule-validation.test.mjs test/learning-platform/schedule-communication.test.mjs test/learning-platform/path-activity.integration.test.mjs test/learning-platform/finalize.integration.test.mjs test/connections/*.test.mjs
  ```

  Result: 158 cases, 148 passed, 0 failed, 10 skipped. Includes older paths with
  newer activity, ID ties, unchanged reads, activity moving between pages without
  changing the old cursor boundary, refresh, invalid/legacy/cross-viewer cursors,
  HTTP/Swagger activity output and existing schedule/chat/financial regression.

- PostgreSQL/MongoDB server integration cases were skipped because isolated
  `TEST_DATABASE_URL`/`TEST_MONGODB_URI` were unavailable and Docker was not running.
  The new SQL fixture is also wired into `test:learning-platform:integration` for
  server verification. No new runtime dependency or environment variable.
- Formatting and `git diff --check`: passed.

No live database migration or deployment performed. The PR must call out the
required migration and cursor reset; commit uses a BREAKING CHANGE footer for
the old opaque cursor invalidation.
