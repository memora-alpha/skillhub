# Material publication lock validation

Verified 2026-11-18T11:29:12+07:00 on local Windows/Node 24.18.1.

- Nest build, API TypeScript check and API lint: passed.
- Runtime and catalog Prisma validation: passed.
- Materials unit/HTTP suite: 24 passed, 0 failed.
- Full Materials isolated PostgreSQL suite: 78 passed, 0 failed.

API tests execute built source via Node test runner. Integration uses the existing
fixture's fresh UUID PostgreSQL schemas with all migrations; it does not migrate
application databases. Coverage includes historical publication without purchases,
reviewedAt false positives, permanent content locks, stale lifecycle/moderation
requests, approve/PATCH contention in both orders, new-ID independent purchases,
buyer snapshot downloads, refunds and thumbnail deletion races.

Tooling: the pnpm Corepack shim attempted a blocked download. Commands used the
already cached pnpm 10.24.0 CLI or installed Node CLIs directly. Localhost tests
were rerun outside the restricted network sandbox after loopback EACCES errors.

## Rollout and consumers

Apply `20261118000000_material_publication_lock` with old writers stopped, then
start the new API and clients. No seed or environment changes. Migration preserves
order/snapshot/ledger fields; unknown legacy archives remain excluded from owner
management by their existing marker.

This change is backend-only. Frontend callers require coordinated updates before rollout:

- Expo: `apps/mobile/src/features/materials/api/materials-api.ts` must send
  `expectedListingVersion` for submit/archive and consume owner edit capabilities.

- Web: `apps/web/src/features/learner/account/material-share.tsx` sends no version
  in its create-submit, list-submit and archive requests. Scoped backend guidance
  excludes web edits without an explicit web request.
- Legacy Flutter: `apps/mobile-flutter/lib/features/materials/api/materials_api.dart`
  sends empty submit/archive bodies. The repository's active mobile workspace is
  `apps/mobile`; Flutter was inspected as an affected consumer and not modified.

Deployed API, browser UI and Android/iOS acceptance were not performed.
