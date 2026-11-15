# Implementation Plan: Material Reviews and Thumbnails

**Branch**: `feat/material-reviews-thumbnails` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

Extend the existing `materials` module with its own review aggregate, eligibility
policy, rating projection, report/moderation flow, and cover-thumbnail pipeline.
PostgreSQL owns review/report/summary metadata; existing S3-compatible storage owns
cover and derived bytes; BullMQ performs idempotent thumbnail generation.

Before those additions, harden four confirmed defects in the existing Materials flow:
reactivate a revoked entitlement on repurchase, replace the reversible `consumedAt`
write with durable download grants, relax the false-positive OOXML 10× ratio without
weakening absolute zip-bomb caps, and return a dedicated expansion-limit error.

D1–D4 were approved on 2026-11-14 and are recorded in `spec.md`. All unrelated BE gaps
from the two Sheets remain separate work and must not be mixed into this feature.

## Technical Context

- **Language/Framework**: TypeScript 6, NestJS 11, Prisma 7
- **Storage**: PostgreSQL for authoritative state; S3-compatible object storage for bytes;
  Redis/BullMQ for derivative jobs
- **Existing dependencies**: `sharp`, shared storage/scanner, audit, outbox, auth/RBAC
- **Testing**: Node test runner; fake/unit HTTP suites plus isolated PostgreSQL integration
- **Scope**: `services/api` only
- **Performance target**: material detail performs O(1) summary lookup; review page uses
  indexed keyset pagination; no per-row profile query

## Constitution Check (v1.2.0)

| Area                 | Status         | Design evidence                                                                                   |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Backend scope        | Pass           | Only `services/api` spec/source/test paths.                                                       |
| Module ownership     | Pass           | `materials` owns review/thumbnail state; profile data is read through a user projection contract. |
| Authoritative stores | Pass           | PostgreSQL is authoritative; thumbnails are derived objects with recorded generation.             |
| Atomicity            | Pass (planned) | Review row, summary counters, audit, and outbox commit in one transaction.                        |
| Security/privacy     | Pass (planned) | Explicit ownership/permission checks; private purchase IDs and storage keys excluded.             |
| API contracts        | Pass (planned) | Swagger DTOs, keyset cursor, UTC timestamps, versioned writes.                                    |
| Job reliability      | Pass (planned) | Transactional outbox/job request, idempotent generation, bounded retry, failure state.            |
| Verification         | Pending        | Build, lint, typecheck, behavioral and PostgreSQL suites are tasks, not current evidence.         |

No constitutional exception is requested.

## Architecture and ownership

```text
src/modules/materials/
├── application/services/
│   ├── material-reviews.service.ts
│   ├── material-review-moderation.service.ts
│   ├── material-rating-summary.service.ts
│   └── material-thumbnails.service.ts
├── domain/
│   ├── material-review.policy.ts
│   └── material-thumbnail.policy.ts
├── infrastructure/
│   ├── jobs/material-thumbnail.processor.ts
│   └── storage/sharp-material-thumbnail.adapter.ts
└── presentation/http/
    ├── material-reviews.controller.ts
    ├── material-review-moderation.controller.ts
    └── material-review.dto.ts

prisma/migrations/<timestamp>_material_reviews_thumbnails/
test/materials/reviews*.test.mjs
test/materials/thumbnails*.test.mjs
```

`materials` may read user public profile fields using an exported reader from `users`;
it must not write user tables. It may read entitlement/order state inside the same
transaction through a materials-owned eligibility service because those tables are
already owned by `materials`.

## Delivery phases

1. **Policy gate**: completed; D1–D4 are recorded with the approval date.
2. **Existing-flow hardening**: entitlement reactivation, download-grant state machine,
   refund gate, OOXML limit classification, and focused regressions.
3. **Schema/permissions**: add review, summary, report, thumbnail tables/relations,
   indexes, constraints, permissions, audit actions, and migration tests.
4. **Read path**: public review page, summary, reviewer projection, and material
   list/detail enrichment without N+1 queries.
5. **Write path**: eligibility endpoint and transactional create/update/delete with
   optimistic versioning, duplicate/concurrency protection, summary updates, audit/outbox.
6. **Trust path**: review report queue and staff hide/restore distinct from material reports.
7. **Thumbnail path**: cover upload policy, scan attachment, generation job/adapter,
   public projection, replacement/removal lifecycle.
8. **Hardening/rollout**: Swagger, integration tests, migration/seed, worker restart,
   metrics and recovery check.

## Transaction boundaries

- **Review create/update/delete**: lock material + review identity key; validate live
  eligibility; change review; recompute/update summary; append audit/outbox; commit.
- **Moderation**: lock review + summary; change visibility; update summary; audit/outbox; commit.
- **Cover attach/replace**: lock material; verify CLEAN owner upload; attach cover,
  bump version/state; insert generation request/outbox; commit. Worker runs after commit.
- **Repurchase after refund**: lock material and the `(userId, materialId)` entitlement
  identity; create the new order/ledger, then update the existing REVOKED entitlement to
  ACTIVE with the new source order. Never delete/recreate the entitlement.
- **Download issuance**: create a `PENDING` grant with an expiry not earlier than the
  signed URL TTL, commit, then call storage signing. On success, atomically mark that grant
  `ISSUED` and set order `consumedAt = COALESCE(consumedAt, dbNow)`. On failure, mark only
  that grant `FAILED`. Refund locks the order and rejects `consumedAt`, `ISSUED`, or a
  non-expired `PENDING` grant. A recovery job expires stale PENDING grants after TTL.
- Storage/provider calls never occur while a critical PostgreSQL transaction is open.

## Rollout and compatibility

- Add nullable review/thumbnail fields; existing material clients remain compatible.
- Run Prisma migration, then `identity:seed` for new permissions.
- Deploy API and worker together; old materials use deterministic placeholders.
- Backfill one zeroed `MaterialRatingSummary` per material in bounded batches or create
  lazily on first read/write; choose one method in migration review.
- Expose generation failure only to owner/staff; public callers keep the placeholder.
- Map OOXML expansion overflow to `FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED` (413), not
  `FILE_FORMAT_UNSUPPORTED` (415). Start with 50× ratio plus existing 100 MB absolute,
  1,000-entry, 512 KB central-directory, and 256 KB captured-XML limits; security tests
  must validate the final number before it becomes an accepted constant.

## Verification commands

```powershell
pnpm --filter api db:validate
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api test:materials
pnpm --filter api test:materials:integration
```

The integration suite requires an isolated migrated `TEST_DATABASE_URL` and must test
concurrent review creation, summary consistency, permissions, and thumbnail retry.
