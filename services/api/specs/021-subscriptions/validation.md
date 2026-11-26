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

## Pending

- Apply the migration to an isolated PostgreSQL and check the CHECKs, the partial unique index
  `user_subscriptions_one_current_per_user`, and that `prisma migrate diff` from migrations to
  `schema.prisma` is empty.
- Run the release seed `subscriptions-20261127` against a database (identity + configuration).
- Constitution principles 3, 5, 6 and 8 stay Pending until Phases 2–3 add runtime tests (T030).
