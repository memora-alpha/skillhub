# Learning Request lifecycle fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Keep Ponytail full active in planning, implementation and review.

**Goal:** Fix STT 10/17 atomically, enforce one finalized Path per Request, and prepare a read-only preview of legacy repairs.

**Architecture:** Reuse Request lifecycle CAS, TransactionRunner, Path finalize, settlement ports and existing FK linkage. A concrete Path-owned reader implements the existing cancellation port and supplies source/evidence checks. No new schema, dependency, background synchronization or money policy.

**Tech Stack:** Existing NestJS 11, TypeScript 6, Prisma 7.8/PostgreSQL, pg, node:test and pnpm workspace `api`.

**Spec:** [lifecycle-fix-design.md](lifecycle-fix-design.md), [spec.md](spec.md), [module contracts](contracts/module-ports.md).

**Status:** Implemented and verified locally on 2026-10-29 following user approval ("triển khai đi"). The fresh final review's two P2 findings were reproduced and fixed; final evidence is in [validation.md](validation.md#lifecycle-fix-execution--2026-10-29). No commit/push/deployment or application-data repair is authorized. All paths below are relative to `services/api`.

## Global Constraints

- Backend only. Reuse `fix/learning-request-service`; inspect the current checkout before execution. Do not commit, push, deploy or apply database repairs without authorization.
- User decision: one finalized LearningPath per Request, retaining other drafts; TWO_WAY still has two opposing LearningPlans inside that one Path.
- User decision: prepare read-only legacy reconciliation and proposed transitions; no --apply command or implicit repair in retries.
- Request writes use LearningRequestLifecycleService. Hold/settlement continue through existing money ports; no fee/refund/no-show/dispute-window changes.
- NEGOTIATING → MATCHED is atomic with finalize; MATCHED → CLOSED is atomic with successful full settlement. Direct exchange never updates a Request.
- Lock order: sorted User locks → Request when present → Path and dependent rows → sorted wallet locks. Never acquire an earlier new lock after a later one.
- Preserve owner/version/membership checks, Chat/history, idempotency, UTC, ledger and existing outbox writes. Do not use Path version as Request expectedVersion.
- Ponytail full: reuse existing code/patterns, no generic lifecycle framework; keep necessary race/rollback/security tests. Use Superpowers TDD, systematic debugging on failures, verification-before-completion and review.
- Never treat previously built dist, an old report or a skipped integration test as validation of new source. Resolve local build tooling before the first RED/GREEN cycle.

## Review Focus

1. A Path status regresses but lockedVersion/locked schedule/Session survives: Request cancellation must still be blocked. Task 1.
2. Two drafts finalize, or owner cancellation races finalize: exactly one legal outcome, no orphan Hold/Session. Tasks 2 and 5.
3. Same idempotency key versus different key versus a different Path: replay only the same finalized Path without another transition. Tasks 2 and 5.
4. Worker/manual settlement, one TWO_WAY plan completed, dispute window open, and failure after ledger writes: never close early or commit only one side. Tasks 3 and 5.
5. Legacy source mismatch, multiple committed Paths and stale preview: never auto-select a winner or write during scanning. Task 4.

## Preflight and file responsibilities

- [x] Read design, latest Git status/diff, API AGENTS/README/constitution and existing LR/Path/Session contracts. Keep this document and existing feature plan as the execution ledger; do not regenerate old feature artifacts.
- [x] Resolve pnpm/local CLI invocation. Previous review could run tests against existing dist, but `pnpm` hit a Corepack download/network failure and the API `.bin/nest.cmd` was unavailable. Inspect installed package paths or use the bundled pnpm executable; if installation is needed, run pnpm install at repo root within the approved implementation scope. Do not change dependencies to bypass tooling.
- [x] Use superpowers:using-git-worktrees at execution time to decide isolation from actual Git/artifact state; the current clean feature branch is suitable to reuse if no conflicting work appeared. Do not lose existing env files when switching.
- [x] Build once before tests importing dist, then rebuild after each source change before GREEN. No product change should be justified by stale compiled output.

New production units are `learning-paths/application/services/learning-request-path.reader.ts`, `learning-paths/learning-path-request-state.module.ts` and the concrete `learning-path-lock.ts` helper added during final review to remove participant/Path lock inversion across existing Path, Schedule, Session, report and review writers. Existing lifecycle/Path/Session methods remain the mutation owners. The only new operator program is `scripts/reconcile-learning-requests.mjs`.

## Task 1: Real Path owner reader and cancellation integration

**Files**

- Create `src/modules/learning-paths/application/services/learning-request-path.reader.ts`.
- Create `src/modules/learning-paths/learning-path-request-state.module.ts`.
- Modify `src/modules/learning-requests/application/services/learning-request-lifecycle.service.ts`.
- Modify `src/modules/learning-requests/learning-requests.module.ts` and `application/use-cases/cancel-learning-request.use-case.ts`.
- Remove only the obsolete RequestLockReader implementation from `infrastructure/adapters/unavailable-learning-request-dependencies.ts`; retain unrelated fallback methods unless all callers are proven absent.
- Test `test/learning-requests/lifecycle.test.mjs`; create `test/learning-requests/path-lock.test.mjs` and `test/learning-requests/lifecycle-http.test.mjs`.
- Update `src/modules/learning-requests/presentation/http/learning-requests.controller.ts` Swagger and `specs/007-learning-request/contracts/http.md` for 409 codes.

**Interfaces**

- `RequestPathSource = { requestId: string | null; conversationId: string; proposalId: string; participantAId: string; participantBId: string }` (export from reader file).
- `LearningRequestPathReader.readConversationSource(tx: TransactionContext, conversationId: string): Promise<RequestPathSource>` validates accepted Proposal and matching source/participants.
- `readPathSource(tx: TransactionContext, pathId: string): Promise<RequestPathSource>` also checks Path participants against Conversation.
- `readCommittedPathIds(tx: TransactionContext, requestId: string): Promise<string[]>` returns at most two distinct IDs in deterministic UUID order, enough to distinguish zero/one/multiple. Lock evidence is lockedVersion, LOCKED schedule, existing Session or settledAt, independent of mutable status.
- Existing `assertNotLocked(tx: TransactionContext, requestId: string): Promise<void>` rejects committed evidence with 409 REQUEST_LOCKED; inconsistent/missing negotiation source is REQUEST_LIFECYCLE_INCONSISTENT.
- `LearningRequestLifecycleService.lockForPath(tx: TransactionContext, requestId: string): Promise<Pick<LearningRequestRecord, "id" | "ownerId" | "status" | "version">>` obtains the existing repository lock or throws 404. markMatched/markClosed signatures stay unchanged.

- [x] **RED:** add tests named `cancel permits confirmed but unlocked path`, `cancel refuses lockedVersion after status regression`, `cancel refuses locked schedule or session evidence`, `source mismatch is not direct exchange`, and `real DI uses Path reader`. Assertions: unlocked NEGOTIATING → CANCELLED once; locked case 409 REQUEST_LOCKED/no transition; mismatch 409/no transition; owner 404 and stale version 409 REQUEST_VERSION_CONFLICT unchanged. Test no Conversation for NEGOTIATING fails closed and direct source with both requestIds null is valid.
- [x] Run `pnpm --filter api build`, then `node --test test/learning-requests/lifecycle.test.mjs test/learning-requests/path-lock.test.mjs test/learning-requests/lifecycle-http.test.mjs` from API for the test command. Expect missing reader/exports or current 503 to fail the requested new cases.
- [x] **GREEN:** implement reader and its small acyclic provider module; bind REQUEST_LOCK_READER to it. Add lockForPath; preserve version-before-action precedence and return REQUEST_LOCKED for MATCHED/CLOSED with a current version. Use no direct Request writes in the reader.
- [x] Build and rerun the same tests. Assert actual HTTP success/409 envelopes and generated Swagger, not only decorators; use the existing HTTP harness pattern with real cancellation use case/reader and controlled persistence.
- [x] Review the diff with Ponytail: no speculative interface replacing the existing port, no new dependencies, and no blanket forwardRef. Record check output in validation.md; do not commit.

## Task 2: Finalize, source revalidation and exclusive Path selection

**Files**

- Modify `src/modules/learning-paths/application/services/learning-paths.service.ts` and `learning-paths.module.ts`.
- Modify `test/learning-platform/fixtures.mjs` and its existing fake-db relation support only where required by the new real reader.
- Modify `test/learning-platform/phase2.test.mjs` and `finalize.integration.test.mjs`.
- Update explicit constructors in `test/learning-path-read.test.mjs` and `test/learning-sessions/integration/persistence.test.mjs` as needed; enumerate all `new LearningPathsService` callers before editing.
- Update `src/modules/learning-paths/presentation/http/learning-paths.controller.ts` Swagger, `specs/007-learning-request/contracts/module-ports.md` and relevant `specs/008-connections` contract notes.

**Interfaces**

- Consume reader and lockForPath from Task 1, existing lockUsers, markMatched and finalize response/signature unchanged.
- Add a private `lockLifecycleContext(tx: TransactionContext, actor: Principal, pathId: string): Promise<{ source: RequestPathSource; request: Awaited<ReturnType<LearningRequestLifecycleService["lockForPath"]>> | null }>` in LearningPathsService; it checks membership, locks users/Request, revalidates source, then locks Path. It never starts a transaction.
- Create uses readConversationSource plus the same user/Request gate before inserting a new draft; read-only validateForFinalize reports unavailable/canceled source but remains advisory.

- [x] **RED:** extend behavior tests with `request becomes MATCHED with finalize`, `cancelled request cannot create or finalize a commitment`, `second draft cannot finalize`, `finalize replay keeps request version`, and `direct finalize writes no request`. Test ONE_WAY and TWO_WAY; check exact Session count, one Hold operation, Request version +1 only once, and retained losing drafts.
- [x] Build/run `node --test test/learning-platform/phase2.test.mjs test/learning-requests/path-lock.test.mjs` from API; confirm new tests fail against the old unconnected flow.
- [x] **GREEN:** import reader module/LearningRequestsModule acyclically; inject existing lifecycle and reader. Discover and validate context, lock users → Request → Path, check Request NEGOTIATING and absence of another committed Path before fresh Hold. Recheck after locks. Call markMatched inside finalizeTx before its transaction commits.
- [x] Keep same-Path replay idempotent only after checking it is the unique committed Path and Request MATCHED/CLOSED matches its lifecycle. Different Path returns REQUEST_ALREADY_MATCHED; legacy contradictions return REQUEST_LIFECYCLE_INCONSISTENT before financial writes. Preserve original stale Path-version and membership behavior.
- [x] Build/rerun focused tests; add Request rollback assertions to the existing PostgreSQL failure-after-Hold test and original replay assertions. Run with required isolated TEST_DATABASE_URL in Task 5; a skip is pending, not pass.
- [x] Ponytail review: use current FK linkage and Request lock/CAS; no matchedPathId migration, duplicate orchestration framework, or asynchronous state-sync handler. Record result; do not commit.

## Task 3: Close Request in the existing settlement owner flow

**Files**

- Modify `src/modules/learning-sessions/application/services/learning-sessions.service.ts` and `learning-sessions.module.ts`.
- Modify `test/learning-platform/phase2.test.mjs` and `fixtures.mjs`.
- Update constructor call sites in `test/bigint-responses.test.mjs`, `test/credit/http.test.mjs` and `test/learning-sessions/integration/persistence.test.mjs`; grep all call sites again.
- Modify/add assertions in `test/learning-sessions/` completion/worker suites and Task 5 integration suite.

**Interfaces**

- Consume reader, lockForPath and markClosed; keep PathSettlementPort, CreditLedgerAdapter, money calculations and public settlePath/worker interfaces unchanged.
- A private `lockSettlementContext(tx: TransactionContext, pathId: string, actor?: Principal)` in LearningSessionsService uses the same source check and user → Request → Path order. Return source/request snapshot; the existing settle method owns all writes.

- [x] **RED:** add `request stays MATCHED until successful settlement`, `TWO_WAY one plan complete cannot close request`, `successful settlement closes only source request once`, `worker and manual replay do not increment request twice`, `direct settlement touches no request`, and `legacy cancelled or mismatched request cannot be silently repaired`.
- [x] Build/run `node --test test/learning-platform/phase2.test.mjs` and the affected completion/worker files discovered above. Confirm old code leaves Request MATCHED after successful settlement.
- [x] **GREEN:** take source locks before Path, preserve all existing completion/dispute/settledAt checks. Call markClosed after money and completion side effects and before commit, with the locked current Request version. Existing settled replay must validate consistent CLOSED and return without another mutation; legacy mismatch remains a review item.
- [x] Test that failure in lifecycle transition, outbox or subsequent completion work rolls back ledger, allocations, Path, reputation/learned-skill writes and Request together on PostgreSQL (Task 5). No new callback from Credit owner into Requests and no Request write inside ledger service.
- [x] Run affected regressions and Ponytail review; retain unchanged fee/minimum policy and pre-existing settlement semantics. Record evidence; do not commit.

## Task 4: Read-only legacy reconciliation preview

**Files**

- Create `scripts/reconcile-learning-requests.mjs`.
- Create `test/learning-requests/reconciliation.test.mjs`; reuse Task 5 isolated schema for SQL/CLI integration.
- Add `learning-requests:reconcile` script to `package.json` pointing to `node scripts/reconcile-learning-requests.mjs`.
- Update `specs/007-learning-request/quickstart.md` with invocation, report format, review criteria and rollout gate.

**Interfaces**

- CLI: `node scripts/reconcile-learning-requests.mjs [--limit 200] [--after <request-uuid>]`, dry-run only; mandatory LEARNING_REQUEST_RECONCILIATION_DATABASE_URL.
- Output `{ mode: "dry-run", scannedAt, nextCursor, items: [{ requestId, expectedRequestVersion, classification, candidatePathId, evidence, proposedTransitions }] }`.
- classification is NO_CHANGE, NEEDS_REPAIR or MANUAL_REVIEW. Missing/invalid source is never silently skipped as direct exchange. More than one committed Path never gets an automatically selected winner.
- Inconsistency classification runs first: MATCHED/CLOSED with no committed Path and Sessions/Hold without lockedVersion are MANUAL_REVIEW. No committed Path is NO_CHANGE only for a compatible pre-match state with valid source and no commitment evidence; a clean CANCELLED history can also remain unchanged.
- Use the existing `postgresConnectionString` helper from compiled dist and installed pg. No Nest application context/worker startup, no dotenv auto-load of the app database, no SQL writes or --apply branch.

- [x] **RED:** assert NEEDS_REPAIR/MATCHED for one consistent locked path; NEEDS_REPAIR/CLOSED only with complete sessions and consistent successful settlement; NEGOTIATING→CLOSED preview includes both transitions; a valid pre-match request with no commitment is NO_CHANGE; MATCHED/CLOSED with no committed path, Session/Hold without lockedVersion, and multiple/partial/cancelled/mismatched commitment evidence are MANUAL_REVIEW. A clean CANCELLED history stays unchanged. Reject unknown flags, limit outside 1..1000 and invalid UUID before connecting.
- [x] Run `node --test test/learning-requests/reconciliation.test.mjs`; verify missing CLI/function behavior fails the new assertions.
- [x] **GREEN:** implement the single bounded scanner/report program. Use REPEATABLE READ READ ONLY, deterministic UUID pagination, bounded connection/query timeout, safe error messages and finally cleanup. Count all required evidence, including full plan/session completion and settlement snapshot/operation consistency, not just Path status.
- [x] Run tests and isolated-DB CLI check. Snapshot relevant business/audit/outbox table rows before/after; confirm identical, including sequences where relevant. A read-only DB role should also succeed. Test cursor page boundaries and repeat scan produces the same proposed transitions for unchanged input; timestamps may differ.
- [x] Document that preview is stale once data changes and any future apply must re-lock/revalidate version/evidence. Do not create an apply tool, run it against the user database or repair via a migration. Record result; do not commit.

## Task 5: Real races, rollback, regression and handoff

**Files**

- Create `test/learning-requests/lifecycle.integration.test.mjs` using the existing finalize integration's per-run isolated schema and chronological migrations pattern.
- Modify `package.json` to include new unit/HTTP tests in test:learning-request and the new integration file in test:learning-request:integration.
- Update `specs/007-learning-request/plan.md`, `validation.md`, `contracts/http.md`, `contracts/module-ports.md`, relevant Path/Session contract notes, and both lifecycle design/plan statuses based on actual evidence.

- [x] Require TEST_DATABASE_URL through `test/require-integration-env.mjs`; never fallback to DATABASE_URL. Use a throwaway migrated schema; do not run migration/deploy against the user's application schema.
- [x] Add deterministic barriers with two database connections, not timing sleeps: (a) cancel holds Request lock first; (b) finalize holds it first; (c) two Paths finalize against one Request. Assert blocked call resumes into a legal 409, only winner writes, no deadlock, one financial operation, correct Request/Path/Session versions/counts. Confirm bounded retry still produces one winner.
- [x] Inject errors after Hold/Session creation, after markMatched, after settlement ledger and at markClosed/completion/outbox. Assert every transaction-owned state is rolled back. Test same-key/different-key replay, worker replay, ONE_WAY/TWO_WAY, direct exchange, wrong owner, stale version, source mismatch and lockedVersion despite status regression.
- [x] Build then run the focused new integration suite. Expected: no failures and **no skipped mandatory cases**. Unavailable PostgreSQL remains an explicit blocker for completion, not grounds to reduce the tests to mocks.
- [x] Run final `pnpm --filter api lint`, `pnpm --filter api check-types`, `pnpm --filter api build` in sequence; run test:learning-request and test:learning-request:integration. Also run test:learning-platform, test:learning-sessions, test:learning-paths and test:bigint-responses; affected credit HTTP and session persistence tests run against the isolated test DB. Avoid rebuilding the same source repeatedly when invoking already-built node:test files.
- [x] Use Superpowers verification-before-completion and requesting-code-review for correctness/owner/financial concurrency review; apply ponytail-review separately for unnecessary complexity. Fix material findings and rerun only affected checks plus required final gates. Update this plan as tasks complete.
- [x] Review diff/status for unintended changes. Hand off code, evidence and reconciliation usage with remaining UAT/deployment/data-repair gates. Do not claim deployed or repaired. Commit/push remains unauthorized; if later requested, stage only intended files and use an api-scoped Conventional Commit without bypassing hooks.
- [x] Document the authorized rollout sequence: preliminary preview/review → stop and drain all old lifecycle HTTP writers and settlement workers → final preview and separately approved repair → verify → start only new-version writers. Do not run mixed versions or add a feature flag for this change. An unresolved legacy mismatch blocks rollout, not merely the report's status label.

## Plan self-review

- Coverage: STT 17 is Task 1; STT 10 match is Task 2; close is Task 3; both user decisions are Tasks 2/4; shared atomicity/races are Task 5.
- Interfaces: Task 1 owns the source/evidence reader and lifecycle lock; Tasks 2/3 consume the same names and Request version; Task 4 cannot mutate them.
- Scope: no new database schema/dependency, no mobile/web/Chat rewrite, no unrelated scheduling/no-show/429 work.
- Runtime checks were completed against freshly built source and a disposable PostgreSQL database: 224 unit/HTTP and 36 integration tests passed with no skips. The application database was not used. See validation.md for the exact suite breakdown and CLI substitution.
- Fresh builder review resolved the preview-precedence and old-writer rollout gaps in the design and Tasks 4/5. No additional business decision was needed.
- Execution: user approved inline implementation; independent correctness and Ponytail reviews completed, both P2 findings reproduced and fixed. Keep the current branch and uncommitted working tree. Deployment and application-data repair remain outside the approved execution scope.
