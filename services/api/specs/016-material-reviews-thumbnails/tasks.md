# Tasks: Material Reviews and Thumbnails

**Prerequisite**: D1–D4 were approved and recorded in [spec.md](spec.md) on 2026-11-14.

## Phase 1 — Existing Materials correctness (P0)

- [x] T001 Add a PostgreSQL regression: purchase → refund → repurchase creates a new
      order/ledger result and reactivates the same entitlement ID without `P2002`.
- [x] T002 Plan and migrate `MaterialDownloadGrant` with state/expiry indexes.
- [x] T003 Replace reversible `consumedAt` rollback with the PENDING→ISSUED/FAILED grant
      protocol; add stale-PENDING recovery after signed URL TTL.
- [x] T004 Add a deterministic concurrent test where one signing request succeeds and
      another fails; refund must remain blocked and `consumedAt` must stay non-null.
- [x] T005 Split archive-limit errors from unsupported-format errors in the detector and
      HTTP contract; preserve MIME/structure/macro/encryption classifications.
- [x] T006 Add the supplied >10× valid DOCX regression fixture plus malicious archives
      for ratio, absolute expanded size, entry count, central directory, and captured XML.
- [x] T007 Security-review and record the final OOXML ratio (50×) while keeping
      the 100 MB absolute cap. Do not implement an unbounded decompression path.

## Phase 2 — Review contract and schema

- [x] T008 Record approved D1–D4 and update acceptance cases.
- [x] T009 Add Prisma entities/relations/indexes/checks from `data-model.md` and migration.
- [x] T010 Add `material-review:*` permissions and seed changes.
- [x] T011 Add audit actions/outbox event catalog and migration/schema tests.

## Phase 3 — Review reads and summary (US1)

- [x] T012 Add review/summary domain policies and response DTOs.
- [x] T013 Implement indexed keyset review listing with batched reviewer public profiles.
- [x] T014 Enrich material list/detail with summary without N+1 queries.
- [x] T015 Add unit/HTTP/PostgreSQL tests for visibility, pagination, privacy, and summary.

## Phase 4 — Eligibility and writes (US2/US3)

- [x] T016 Implement one shared live eligibility evaluator used by GET and all writes.
- [x] T017 Implement idempotent concurrent-safe create.
- [x] T018 Implement versioned author-only update and replay-safe soft delete.
- [x] T019 Update summary, audit, and outbox atomically in each write.
- [x] T020 Test owner/buyer/free/refund/duplicate/stale/concurrent cases in PostgreSQL.

## Phase 5 — Report and moderation (US4)

- [x] T021 Implement review-specific report persistence and active-report dedupe.
- [x] T022 Implement Staff queue plus versioned hide/restore with mandatory reason.
- [x] T023 Test permission separation from material reports, audit, and summary changes.

## Phase 6 — Cover and thumbnail (US5)

- [x] T024 Extend storage purpose/policy for JPEG/PNG/WebP material covers.
- [x] T025 Implement cover attach/replace/remove state transitions and moderation reset.
- [x] T026 Implement idempotent BullMQ job and Sharp adapter for 320×180/640×360 WebP.
- [x] T027 Add safe delivery projection and deterministic placeholder fallback.
- [x] T028 Test MIME spoofing, scan gate, stale jobs, retry, replacement, and key privacy.

## Phase 7 — Hardening and rollout

- [x] T029 Add Swagger examples/error details and update `specs/011-learning-materials` links.
- [x] T030 Add summary repair/preflight script and operational metrics for failed jobs.
- [ ] T031 Run lint, typecheck, build, focused suites, and isolated PostgreSQL integration.
- [x] T032 Write validation evidence with exact revision, migration, seed, and worker rollout.

## Dependency order

T001–T007 harden the existing flow first. T008 → T009–T011 → T012–T015 →
T016–T020. T021–T023 and T024–T028 may then proceed independently. T029–T032
close the feature. No task changes mobile/web code.
