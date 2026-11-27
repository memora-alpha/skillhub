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
- Usage allowance is the plan value when the period row is created. An upgrade mid-period does not raise it
  until the next period (data model "snapshot of the plan at period start"); flagged for product review.
- `subscription.policy.raisedRetentionDays` from Phase 1 was unused after Phase 5 and was removed.

Not covered: real PostgreSQL concurrency between an `egress_ended` charge and an add-on purchase (both take the
owner lock); T030.

## Pending

- Apply the migration to an isolated PostgreSQL and check the CHECKs, the partial unique index
  `user_subscriptions_one_current_per_user`, and that `prisma migrate diff` from migrations to
  `schema.prisma` is empty.
- Run the release seed `subscriptions-20261127` against a database (identity + configuration).
- Real PostgreSQL: concurrent purchases (partial unique index + owner lock), Serializable retries,
  `chargeSubscription` ledger rows, and an HTTP test through the Nest app (T030).
- Constitution principles 3, 5, 6 and 8 stay Pending until T030.
