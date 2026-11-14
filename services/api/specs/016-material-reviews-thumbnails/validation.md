# Validation: Material Reviews and Thumbnails

**Validated**: 2026-11-14
**Baseline revision**: `5a70621d4bf5970e8c2fa8bef81b9725f58fce76` (`dev`)
**Implementation state**: local worktree; assign the resulting commit SHA during merge/release.

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

## Remaining environment gate

T031 remains open because this environment has no `TEST_DATABASE_URL`. The integration
guard exits with `TEST_DATABASE_URL is required for isolated PostgreSQL integration
tests.` Run the following against an isolated migrated database before release:

```powershell
$env:TEST_DATABASE_URL = "postgresql://.../skillhub_test"
pnpm test:materials:integration
pnpm test:files:integration
```

Also rehearse migration rollback/restore in a disposable database and run a fresh Sonar
analysis for the implementation commit. Local checks do not claim cloud Quality Gate
closure.
