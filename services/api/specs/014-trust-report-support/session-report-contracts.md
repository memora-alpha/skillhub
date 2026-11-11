# Session and report contract fixes

Branch: `fix/session-report-contracts`, based on `dev` at `a38d038c`.
Scope: API only. This extends the existing report-support implementation.

## Behavior and contract

- `GET /reports/mine` and `/reports/mine/:caseId` include both current and legacy
  evidence in `reportEvidenceCaseIdRecords`, plus `evidenceCount`. Entries contain
  `id`, nullable `storedFileId`, `mimeType`, decimal-string `fileSizeBytes`, and
  `uploadedAt`. Only the caller's party is included. Null-party legacy evidence
  belongs to the original reporter; it is never attributed to the partner or to
  a participant in a system-created case. Staff moderation views retain their
  broader authorized scope. Storage keys and private file names are not returned.
- Session list/detail include `deadlines.reportBy` and
  `reporting: { canReport, blockedReason, reportBy, evaluatedAt }`.
  The current occurrence's attendance outcome supplies the deadline when present;
  otherwise it is session end plus the existing configured dispute window.
  Eligibility follows POST: participant, session not cancelled, no open report
  by this caller for the session, database time strictly before the deadline.
  Missing policy returns a null deadline and `REPORT_POLICY_UNAVAILABLE` on reads.
  No additional earliest-report time or path-status restriction is introduced.
  Existing no-show actions and `excuseOrReportBy` keep their meaning. This is an
  advisory snapshot; POST rechecks under its existing transaction and locks.
- Participant case summaries/lists include `hasHandler`, `ownEvidenceCount`,
  `canSendMessage`, `messageBlockedReason`, `canAttachEvidence`, and
  `evidenceBlockedReason`. New messages require an open case and assigned handler.
  Evidence requires an open case and fewer than five own entries, including
  legacy entries; it does not require a handler. Active ALL restrictions block
  both actions. These flags describe new commands; successful idempotent replays
  retain the existing behavior. Upload readiness and authorization are rechecked
  by POST. Internal handler/reporter IDs and partner evidence remain private.
- Support notification payloads retain `caseId`/`partyId` and add canonical
  `relatedPathId`/`pathId`, `relatedSessionId`/`sessionId`, `relatedOrderId` when
  present, and the validated `messageId` or `evidenceId`. References come from
  the case after receipt validation, so partner/system cases can be routed.
  Existing recipients, outbox delivery and duplicate protection are retained.

No environment variables, seed changes, schema migration or data backfill are
required. Mobile consumers must use these additive fields to expose the UI.

## Constitution Check

- Pass: backend module boundaries retained; pure policy helpers serve reads and
  writes. Reports owns report eligibility, evidence scoping and case capabilities.
- Pass: PostgreSQL remains authoritative for cases, receipts, evidence and policy;
  Mongo continues to own message documents. No new store or provider call added.
- Pass: existing write locks, transactions and outbox remain intact. Reads batch
  related metadata and counts. UTC database time governs reporting eligibility.
- Pass: participant membership/private-thread rules retained; evidence metadata
  is caller-scoped; sizes are JSON-safe strings; Swagger describes new fields.
- Pass: API lint, typecheck and build; 150 focused regression/HTTP tests pass,
  including seven new session/report contract tests. `git diff --check` passes.
- Pending: real PostgreSQL/Mongo/storage integration and deployed delivery are
  not established by the in-memory regression suite.

## Verification

`test/session-report-contracts.test.mjs` covers current/legacy evidence privacy,
private downloads, independent message/evidence capabilities, report windows and
POST parity, notification context/idempotency, and HTTP contracts. Run alongside
report-support, session, path-overview and notification regressions.

Validated locally on 2026-11-11:

```powershell
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
# From services/api, after build (150/150 pass, no skips):
node --test --test-reporter=dot test/session-report-contracts.test.mjs test/report-support.test.mjs test/learning-platform/phase3.test.mjs test/bigint-responses.test.mjs test/path-overview.test.mjs test/learning-path-read.test.mjs test/learning-sessions/*.test.mjs
```

The first run exposed missing implicit to-one relation filtering in the fake
database; the helper now supports the Prisma filter used by participant cases.
The complete suite passed after that correction. HTTP checks use a local Nest
server with in-memory storage adapters. TEST_DATABASE_URL and TEST_MONGODB_URI
are unset; real datastore concurrency, file storage and provider delivery remain
unverified. No database, seed, production configuration or deployment was changed.
