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

## Pending

- Apply the migration to an isolated PostgreSQL and check the CHECKs, the partial unique index
  `user_subscriptions_one_current_per_user`, and that `prisma migrate diff` from migrations to
  `schema.prisma` is empty.
- Run the release seed `subscriptions-20261127` against a database (identity + configuration).
- Real PostgreSQL: concurrent purchases (partial unique index + owner lock), Serializable retries,
  `chargeSubscription` ledger rows, and an HTTP test through the Nest app (T030).
- Constitution principles 3, 5, 6 and 8 stay Pending until T030.
