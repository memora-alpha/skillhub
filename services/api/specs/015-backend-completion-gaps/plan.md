# Backend completion gaps

Branch: `fix/backend-completion-gaps`. Base: dev `f217b099`. Started 2026-11-09.

## Accepted scope

- Reject new PATH_TERMINATION after all agreement sessions are COMPLETED under
  the existing Path lock; replay already-created requests before this check.
- Order own/public Sharing Skills by createdAt DESC, id DESC and expose createdAt.
  Old ID-only list cursors must restart at page one.
- Cursor pagination for sessions/mine and owner materials, buyer orders and Staff
  material queues. Preserve HTTP data arrays and add meta.pagination.
- Public and own profiles include completedLearningPathCount (COMPLETED + settledAt).
- Staff with explicit delegated permissions can hide avatar/bio or request edits,
  with version checks, independent actor checks, reason and atomic audit.
- User notification preferences: learning, credit, community; default enabled.
  Apply at dispatch/delivery; existing inbox history stays. Security/auth unaffected.
- Hide or restore entire reviews using version/reason/audit; exclude hidden rows
  from lists and aggregates; reputation and its history stay unchanged, as approved.
- Admin manages immutable DRAFT -> APPROVED material fee versions, may approve their
  own draft, with reauthentication and audit. New purchases pin the effective policy;
  existing orders keep their snapshots. Learning fees remain fixed at 4%.
- Read-only daily/monthly UTC collected/refunded/net Credit fee report by operation.
  Material refunds are accounted by refund operation time; this is recorded Credit
  fee activity, not VND revenue or profit. Credit penalty percentages are outside scope.

## Contract and rollout

Read `contracts.md` for routes and compatibility. Apply
`20261109000000_backend_completion_gaps` before starting this API revision. It adds
columns, indices and Admin grants; no separate seed or new env required. Admin must
grant profile:moderate/review:moderate to the intended Staff. No FE changes in scope.
The migration also fixes the pre-existing SUCCESS-only material order constraint:
the existing refund workflow requires REFUNDED. Refund arithmetic is unchanged.

## Constitution check

- Scope/module boundaries: Pass design; API only, owner services and existing roots.
- PG authority and atomicity: Pass design; locks, writes and audit share transaction.
  Preferences and moderation never move financial state across stores.
- Auth/privacy: Pass design; live sessions, explicit permissions, independent Staff,
  own-only preference writes, private moderation details, no provider secrets.
- Financial invariants: Pass isolated PG tests. Existing fee arithmetic/snapshots retained;
  only new material purchases can adopt approved future fee versions.
- Cross-store jobs: No new cross-store command; avatar hide cancels pending selection.
- Verification: Pass local checks below. Local checks do not establish deployment
  verification or provider delivery.
- Exceptions: None.

## Validation observed 2026-11-09

- Prisma format, validate and generate: passed. The schema generator was updated
  alongside the generated schema; isolated PG setup applies every migration.
- API TypeScript no-emit, Nest build and ESLint for changed TS/MJS: passed.
- `TEST_DATABASE_URL=... node scripts/test-connections-regressions.mjs`:
  343 tests, 342 passed, 0 failed, 1 skipped. Includes the new completion-gap unit
  suite and isolated PostgreSQL suite (11 tests including the parent).
- `node --test --test-concurrency=2 test/connections/bootstrap.test.mjs
test/learning-sessions/*.test.mjs`: 104 passed, 0 failed.
  The existing termination test now opens the request before the final session
  completes, then verifies withdrawal permits ordinary settlement exactly once.
- Existing PostgreSQL material lifecycle and ledger tests: 19 passed, 0 failed.
- PG coverage includes concurrent version allocation, same-Admin approval, one-use
  proof/audit rollback, future effective times, pinned purchase/refund amounts,
  recorded fee reporting, lists above 100, moderation and preference persistence.
- Git diff whitespace check: passed. No application database migration or deployment
  was performed; the PG checks use disposable schemas in the local test container.
