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

## Pending

- Apply the migration to an isolated PostgreSQL and check the CHECKs, the partial unique index
  `user_subscriptions_one_current_per_user`, and that `prisma migrate diff` from migrations to
  `schema.prisma` is empty.
- Run the release seed `subscriptions-20261127` against a database (identity + configuration).
- Real PostgreSQL: concurrent purchases (partial unique index + owner lock), Serializable retries,
  `chargeSubscription` ledger rows, and an HTTP test through the Nest app (T030).
- Constitution principles 3, 5, 6 and 8 stay Pending until T030.
