# Validation: Material Reviews and Thumbnails

**Validated**: 2026-11-15
**Baseline revision**: `5a70621d4bf5970e8c2fa8bef81b9725f58fce76` (`dev`)
**Implementation revision**: `d10725c646f60870a016f712c2ef13a79d909fe1`

## Database and rollout

- Migration: `prisma/migrations/20261114100000_material_reviews_thumbnails/migration.sql`.
- The download-grant change uses expand → backfill from material orders → constrain.
  `orderId` remains nullable for free-public grants and `materialId` becomes required only
  after backfill.
- Existing materials receive a zero-valued rating summary during migration.
- Permission catalog adds `material-review:moderate`; the default role mapping grants it
  to ADMIN only. No separate data seed is required because permission defaults are
  code-owned and covered by the schema/authorization tests.
- The thumbnail outbox publisher must be deployed with the API and BullMQ worker. Deploy
  the migration before enabling new API instances, then start workers. Old-generation
  jobs are safe because the worker rechecks `coverGeneration` while holding the material
  lock before publishing READY results.
- Failed thumbnail rows retain a bounded `failureCode` and attempt count for operational
  queries; rating drift can be inspected or repaired with
  `node scripts/reconcile-material-rating-summaries.mjs [--apply]` using the dedicated
  reconciliation database URL.

## Verification evidence

- `prisma validate --schema prisma/schema.prisma`: passed.
- `eslint . --max-warnings 0`: passed.
- `tsc --noEmit`: passed.
- `nest build`: passed.
- Material policy/review/thumbnail/notification tests: 17 passed, 0 failed.
- File/storage/DOCX tests: 27 passed, 0 failed. The DOCX suite covers a valid archive
  above 10× and below 50× plus ratio, 100 MB declared expansion, entry-count, central
  directory and captured-XML rejection under
  `FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED` (HTTP 413).
- Additional focused review/download/cover PostgreSQL suites were added under
  `test/materials/`, including repurchase and concurrent signing regressions.
- API CI run
  [`43693089091`](https://github.com/memora-alpha/skillhub/actions/runs/43693089091)
  passed on the implementation revision. It deployed the full migration chain to a
  fresh disposable PostgreSQL database, then passed 444 API regressions (443 passed,
  one intentional skip), 64 PostgreSQL/MongoDB connection tests, six
  settlement/serialization regressions, and the release-image build.
- The material and file integration entries are now part of the CI regression manifest,
  so `test:materials:integration` and `test:files:integration` execute with
  `TEST_DATABASE_URL` on every API pull-request run.

## Remaining release-operator gate

Fresh forward deployment and all isolated PostgreSQL integration suites are verified by
the run above. Prisma migrations are forward-only, so rehearse the production
backup/restore rollback procedure against a disposable copy before release. This
operational rehearsal is intentionally not represented as an automated schema-down
migration.
