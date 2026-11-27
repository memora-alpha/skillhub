# Subscriptions — Validation

## Phase 1 — Foundation (2026-11-27)

Static and unit evidence only. Runtime PostgreSQL evidence is pending.

| Check                                                                                                                      | Result                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db:generate:runtime-schema`, `db:validate`                                                                                | Pass. `schema.prisma` regenerated from the overlays.                                                                                                                                                                      |
| Migration `20261127000000_subscriptions`                                                                                   | Generated with `prisma migrate diff` from the previous `schema.prisma` to the new one, then CHECKs and the partial unique index added by hand. **Not applied** to a database: no `TEST_DATABASE_URL`, Docker not running. |
| `check-types`                                                                                                              | Pass                                                                                                                                                                                                                      |
| ESLint on changed files                                                                                                    | Pass                                                                                                                                                                                                                      |
| `build`                                                                                                                    | Pass                                                                                                                                                                                                                      |
| `test/subscriptions/policy.test.mjs`, `test/configuration-policy.test.mjs`, `test/learning-requests/access.test.mjs`       | 20/20 pass                                                                                                                                                                                                                |
| Regression: `test/learning-sessions/*.test.mjs`, authorization, staff permissions, configuration, rewards, material policy | 244/244 pass                                                                                                                                                                                                              |

## Phase 2 — Core (2026-11-27)

Static and unit evidence only, against the in-memory fake database used by the learning-platform suites.

| Check                                                                                                                                                                      | Result                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-types`, `build`, ESLint on changed files                                                                                                                            | Pass                                                                                                                                                                                                                                                                                  |
| `test/subscriptions/*.test.mjs`                                                                                                                                            | 18/18 pass: purchase, replay and key reuse, refusals with no write, one current subscription, lapsed term closed on purchase, prorated upgrade and stale quote, PATCH keep/clear/upgrade refusal and kill switch, entitlement reader, plan version lifecycle, charges and admin reads |
| Regression: learning-platform, learning-sessions, rewards, credit unit, audit, authorization, configuration, access, materials policy, report support, learning-path reads | 364/364 pass                                                                                                                                                                                                                                                                          |

Notes:

- The tests use the real `AuditWriter`, so every audit projection is validated against the catalog.
- Idempotency and the Credit debit are fakes in these tests. `IdempotencyService` and the
  shared `debitAvailable` (now also behind `redeemVoucher`) are covered by their own suites.
- The fake database has no rollback, so refusal tests check that the service writes nothing
  before the failing step; the purchase debits Credit before creating any subscription row.
- The Nest application was not booted; the module imports mirror `RewardsModule`.

## Phase 3 — Renewal (2026-11-27)

| Check                                                                                     | Result                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-types`, `build`, ESLint on changed files                                           | Pass                                                                                                                                                                                                                                                                                                                                          |
| `test/subscriptions/*.test.mjs`                                                           | 27/27 pass. Renewal: renew once from the old term end, repeated run, auto-renew off, grace with retries capped at `graceUntil`, top-up renewal, grace elapsed, zero grace days, scheduled downgrade and interval with the new price, very late run, retired plan. Notification handler: registration, rendering, owner only, invalid payloads |
| `test/connections/bootstrap.test.mjs`                                                     | Pass. Boots the feature modules, so `SubscriptionsModule`, the renewal worker and the notification handler resolve through Nest DI                                                                                                                                                                                                            |
| Full regression set (above plus notification delivery, completion gaps, report contracts) | 404/404 pass                                                                                                                                                                                                                                                                                                                                  |

Findings fixed during this phase:

- The event name `subscription.grace_started` failed the outbox type pattern `[a-z0-9.:-]`;
  the bootstrap test caught it. The event is `subscription.grace-started`.
- Phase 2 closed a lapsed row inline on purchase or PATCH, which would also have closed an
  auto-renewing row the job was about to renew. Term-end transitions now belong to the job only;
  user routes answer `409 SUBSCRIPTION_RENEWAL_PENDING` in that window.
- Purchase and upgrade emit no outbox event: the dispatcher fails events without a publisher.

Not covered: `renewDue` (its claim is raw SQL the fake database does not run) and real
concurrent workers; both belong to T030.

## Phase 4 — Fee tiers (2026-11-27)

| Check                                                                       | Result                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db:generate:runtime-schema`, `db:validate`, `check-types`, `build`, ESLint | Pass                                                                                                                                                                                                                                                                                                                                |
| Migration `20261127010000_fee_policy_tiers`                                 | Four `ALTER TYPE "FeePolicyCode" ADD VALUE`. Not applied to a database                                                                                                                                                                                                                                                              |
| `test/subscriptions/fee-tiers.test.mjs`                                     | 6/6 pass: ONE_WAY pins the teacher's tier and settles at 2% after the plan ended; tier without an approved policy falls back to 4%; TWO_WAY never reads a tier; `effectiveFeePolicy` ordering, future and DRAFT versions; `feeTier` reads no configuration; fee admin drafts tier series with the right rule shape and audit action |
| Full regression set (with the materials unit suites and bootstrap)          | 451/451 pass                                                                                                                                                                                                                                                                                                                        |

Design notes:

- `FeePolicyCode` turned out to be a database enum, not a string column; the data model was corrected.
- `feeTier` reads the subscription only. Using `forUser` would read `subscription.freeEntitlements`
  for every Free user and make ONE_WAY scheduling and material purchases fail if that key was
  not seeded.
- Tier fee policies notify the approving Admin only; the all-user broadcast stays for base series.
- `LearningPathsService` and `MaterialPurchaseService` take the reader as their last constructor
  argument. Both modules import `SubscriptionsModule`; the bootstrap test resolves them.

Not covered: the material purchase path with a tier seller runs only in the PostgreSQL integration
suite (`test/materials/purchase.test.mjs`), which was not run. `effectiveFeePolicy` it calls is unit tested.

## Phase 5 — Whiteboard retention (2026-11-27)

| Check                                                                                   | Result                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-types`, `build`, ESLint                                                          | Pass                                                                                                                                                                                                                              |
| `test/subscriptions/whiteboard-retention.test.mjs`                                      | 9/9 pass: helpers; Free leaves no snapshot (30 days); either participant's longest plan; never decreases after a plan ends; a plan bought inside the edit window raises it; worker keeps 180 days; longer config wins; read field |
| `test/learning-sessions/whiteboard*.test.mjs` (spec 019 suites)                         | Pass; the GET shape assertion gained `retentionDays: null`                                                                                                                                                                        |
| Regression set: subscriptions, learning-sessions, learning-platform, reports, bootstrap | 337/337 pass; bootstrap resolves `LearningSessionsModule` importing `SubscriptionsModule`                                                                                                                                         |

Design notes:

- Free contributes no snapshot. `whiteboard.retentionDays` is the Free value and also the floor:
  the worker keeps a board `max(snapshot, config)` days, so raising the config never deletes a paid
  board earlier than a Free one. Spec D10 said "the snapshot"; this is a clarification, not a change
  for any default value.
- The config value bounds the candidate query; rows kept longer by their snapshot are examined and
  skipped in memory, and paging still advances past them. Boards between 30 and 365 days old are
  re-examined each hourly sweep, which is acceptable at current volume.
- Saves read plans through `paidEntitlements`, which reads no configuration, so an unseeded
  `subscription.freeEntitlements` cannot block whiteboard saves.

## Phase 6 — Recording (2026-11-27)

| Check                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-types`, `build`, ESLint                                                                                                   | Pass                                                                                                                                                                                                                                                                                                                                                                                       |
| `test/subscriptions/recording-minutes.test.mjs`                                                                                  | 14/14 pass: Free and no-recording plans refused; start pins plan and 30-day retention; 90 s charges 2 minutes; duplicate webhook; overrun spends period then add-on and absorbs the rest, then exhausted; plan ended before `egress_ended`; plan lapsed before accept; snapshot vs legacy retention sweep; legacy wiring; GRACE period; add-on charge, replay, carry and renewal; refusals |
| Spec 020 suites (`test/learning-sessions/recording*.test.mjs`)                                                                   | Pass unchanged                                                                                                                                                                                                                                                                                                                                                                             |
| Regression set: subscriptions, learning-sessions, learning-platform, reports, audit, materials and credit unit suites, bootstrap | 388/388 pass                                                                                                                                                                                                                                                                                                                                                                               |

Design notes:

- The plan is checked on request and on accept; accept pins `subscription_id` and `retention_days`, which is
  the "start" of D12.
- `charged_minutes` stores what the plan paid (period plus add-on), not the recorded length. The row moves to
  READY and is charged in one transaction; a second delivery cannot move it again, and the
  `charged_minutes IS NULL` update is a second guard that rolls the charge back.
- A recording snapshot replaces `recording.retentionDays` even when shorter (Creator 30 vs config 90), unlike
  the whiteboard floor. The sweep therefore bounds snapshot rows by the 1-day minimum and checks each row.
- Usage allowance is the plan value when the period row is created. Resolved later the same day: an
  upgrade raises the current period's allowance at once (see "Upgrade allowance" below).
- `subscription.policy.raisedRetentionDays` from Phase 1 was unused after Phase 5 and was removed.

Not covered: real PostgreSQL concurrency between an `egress_ended` charge and an add-on purchase (both take the
owner lock); T030.

## Phase 7 — Material storage (2026-11-27)

Built on the documented defaults of Q3 (Free 1 GB, existing data kept) and Q4 (removed materials stop
counting at once). G5 stays open: PO approval of those defaults is still required.

| Check                                                    | Result                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-types`, `build`, ESLint                           | Pass                                                                                                                                                                                                                                                                                          |
| `test/subscriptions/material-storage.test.mjs`           | 7/7 pass: refusal past the allowance rolls back, exactly at the limit allowed; replacing a file excludes its old file; removed stops counting, archived counts; flag off or unwired applies none; plan raises it and expiry keeps data but refuses new; `GET /me/subscription` and admin view |
| Regression set incl. materials unit suites and bootstrap | 416/416 pass; `fee-tiers` now scopes its no-configuration guard to `feeTier`, since `me()` reads the flag for `materialStorage.enforced`                                                                                                                                                      |

Design notes:

- Quota applies only while `subscription.enabled` is on. With plans off a 1 GB Free limit would block
  uploads with no way to buy more space.
- The check runs after the upload is bound, in the same transaction, under the advisory lock
  `material-storage:<ownerId>`; a refusal rolls the binding back so the upload stays attachable.
- Only a material's current file counts. Covers, replaced files kept for buyers, and other upload
  purposes do not.
- `usage` lost `materialStorageBytesUsed/Allowed`: usage exists only for subscribers, so storage moved to
  a top-level `materialStorage` returned for every user. The admin user view now also returns usage,
  entitlements and storage, which its contract already promised.
- The fake database maps the `materials` FOR UPDATE lock, so `MaterialsService` runs in unit tests.

Not covered: two concurrent attaches near the limit on PostgreSQL (US8 independent test); T030.

## Real PostgreSQL — T030/T031 (2026-11-27)

Run on the developer's local PostgreSQL 17 service (port 5432, server timezone `Asia/Bangkok`) with
user approval. Every suite migrates a fresh `skills_test_<uuid>` schema and drops it; the `public` schema
is never read or written. Docker was unavailable, so no throwaway container was used.

| Check                                                                                    | Result                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:subscriptions:integration` (`subscriptions`, `subscriptions-http`, `release-seed`) | 12/12 pass                                                                                                                                                                                  |
| Migrations                                                                               | All 68 apply on a fresh schema; the four spec 021 CHECKs exist; the one-current partial unique index and `termEnd > termStart` reject bad rows                                              |
| Concurrent purchases (3 keys)                                                            | One succeeds, two `SUBSCRIPTION_ALREADY_ACTIVE`; one charge, one `SUBSCRIPTION_CHARGE` operation with a `SUBSCRIPTION_PURCHASE` ledger row; replaying the winning key charges nothing       |
| Short balance                                                                            | `INSUFFICIENT_AVAILABLE_CREDIT`, no subscription row                                                                                                                                        |
| `renewDue` × 3 concurrently                                                              | Raw `FOR UPDATE SKIP LOCKED` claim works; renewed once, one RENEWAL charge, one `subscription.renewed` event; next run finds nothing                                                        |
| Minutes vs add-on                                                                        | 3 concurrent minute charges and an add-on purchase: used 23, add-on 60, wallet debited once; no lost update                                                                                 |
| Material storage                                                                         | 3 concurrent 2000-byte attaches under a 3000-byte plan: exactly one passes (US8 independent test)                                                                                           |
| HTTP (Nest testing module, real guard)                                                   | 401 without session; `IDEMPOTENCY_KEY_REQUIRED`; DTO validation; purchase, add-on, `GET /me/subscription`, charges with Credit strings                                                      |
| Release seed `subscriptions-20261127`                                                    | `seedIdentity` + `seedApprovedConfigurations` twice: USER/STAFF/ADMIN subscription permissions as specified; `subscription.enabled = false`; add-on 60/30; Free defaults                    |
| Schema drift (`prisma migrate diff`, migrated schema vs `schema.prisma`)                 | 87 lines of drift, identical to the pre-021 base (`d54c775a`): FKs, `updated_at` defaults, `proposals.expires_at`. Nothing touches spec 021 objects; the pre-existing drift is out of scope |
| Existing materials integration suites                                                    | Pass (purchase path with `feeTiers` wiring, lifecycle, access, reviews, reports, favorites, covers)                                                                                         |
| `learning-platform/finalize.integration`                                                 | Pass (one transient failure in a run that overlapped other DDL; three reruns pass)                                                                                                          |
| `learning-platform/path-activity.integration`                                            | Fails only under the server's `Asia/Bangkok` timezone (dates shift 7 h); passes with session `TimeZone=UTC`. Environment issue, unrelated to spec 021                                       |
| `lint`, `check-types`, `build`, `test:subscriptions` (62 unit tests)                     | Pass                                                                                                                                                                                        |

Notes:

- `test:subscriptions` now lists its unit files. The old `test/subscriptions/*.test.mjs` glob would pick up
  the integration files, whose fixture falls back to `DATABASE_URL` when `TEST_DATABASE_URL` is unset.
- The release seed scripts build `PrismaPg` without a schema, so they always write `public`; the seed was
  verified by calling the same seed functions against the isolated schema instead.
- Three empty `diff_<uuid>_legacy_v3` schemas left by the one-off drift check remain on the local database
  (the check dropped its main schema but not the one a v3 migration creates). They hold no spec data and
  can be dropped by the developer.

## Upgrade allowance (2026-11-27)

Decision: an upgrade raises the current period's recording allowance to the new plan at once, because
the prorated price pays for the rest of the term. Minutes used and add-on minutes are unchanged; a
downgrade still waits for renewal, so an allowance never falls inside a period.

| Check                                                | Result                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `test/subscriptions/recording-minutes.test.mjs`      | 2 new tests pass: stored period 100/120 + 60 add-on becomes 100/400 + 60 (360 left); no stored row starts at 400 |
| `lint`, `check-types`, `build`, `test:subscriptions` | Pass                                                                                                             |

## SonarCloud — PR #138 (2026-11-27)

Quality Gate failed on one condition: new reliability rating C (two `plsql:CharVarchar` bugs). All other
conditions passed (security A, maintainability A, duplication 0.6%, hotspots 100% reviewed).

| Finding                      | Location                                                            | Disposition                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plsql:CharVarchar` ×2 (BUG) | `20261127000000_subscriptions/migration.sql:83-84`                  | False Positive: PostgreSQL DDL; `VARCHAR2` is Oracle. `CHAR(64)` holds a fixed-length SHA-256 hex digest, the repo's convention (payments, learning cancellation). `VARCHAR(64)` would raise `plsql:VarcharUsageCheck` instead |
| `plsql:S1192` ×3             | same migration, enum literals                                       | Accepted: PostgreSQL enum and CHECK literals cannot use a procedural constant (same as earlier migrations)                                                                                                                     |
| `javascript:S2699` ×2        | `recording-minutes.test.mjs`, `subscriptions.test.mjs`              | Fixed: the `rejects()` helper hid the assertion; both tests now also assert no charge or plan change                                                                                                                           |
| `typescript:S3863` ×2        | `subscriptions.service.ts`                                          | Fixed: one import from `idempotency.service`                                                                                                                                                                                   |
| `typescript:S9382` ×2        | `subscription-renewal.service.ts`, `subscription-renewal.worker.ts` | Accepted: sequential on purpose (per-row owner and wallet locks; the next batch depends on the previous claim), explained in code                                                                                              |

Marking False Positive or Accepted needs a SonarCloud project member; a fresh analysis of the fix revision
must confirm the gate before it is reported as passing.

## CodeRabbit review — PR #138 (2026-11-27)

| Comment                                                                                | Disposition                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GRACE row renewed after `graceUntil` when the wallet was topped up late                | Fixed: `decideAtTermEnd` expires an elapsed GRACE row before `canPay`; expiry reason `GRACE_ELAPSED`. Policy and renewal tests                          |
| Add-on minutes spent twice when an earlier period is charged after a later one started | Fixed: the latest period row of the term holds the one add-on balance; `periodUsage`/`savePeriodUsage` read and write it. Out-of-order test             |
| `usage()` showed 0 add-on minutes at a period boundary                                 | Fixed: `usage()` uses `periodUsage`, the same balance as the charge path. Boundary test in a YEAR term                                                  |
| Renewal before `egress_ended` processing absorbed the minutes                          | Fixed: the charge instant is the Egress end time; a subscription that renewed since pays from its renewed term's first period. Spec D11 states it. Test |
| D10 said config applies only to legacy rows                                            | Fixed: D10 states `max(snapshot, config)`                                                                                                               |
| `update()` comment contradicted the 409 in the lapse window                            | Fixed: comment describes the documented behaviour; no product change                                                                                    |
| Integration fixture leaked the schema on setup failure                                 | Fixed: dispose and rethrow                                                                                                                              |
| Duplicate `idempotency.service` import                                                 | Fixed in `35fcf780`                                                                                                                                     |

Checks after the fixes: lint, check-types, 348 unit/regression tests, 12 PostgreSQL integration tests pass.

## Pending

- Product gates before `subscription.enabled` goes on in production: G3 (plan values), G4 (SRS
  amendment), G5 (Q3/Q4 defaults used by Phase 7), G6 (LiveKit Egress quote).
- Real production-like run of the release pipeline (`scripts/release.mjs`) on a staging database.
