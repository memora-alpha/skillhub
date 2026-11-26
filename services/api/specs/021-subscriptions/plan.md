# Implementation Plan: Subscriptions

**Spec**: [spec.md](spec.md) · **Data model**: [data-model.md](data-model.md) ·
**Contracts**: [contracts.md](contracts.md) · **Policies**: [policies.md](policies.md)

## Summary

Add a `subscriptions` module that sells `CREATOR` and `PRO` plans for Credit and exposes an
entitlement reader. Wire four consumers: fee pinning (learning paths, materials), whiteboard
retention, recording entitlement and material storage. Ship dark behind `subscription.enabled`.

## Technical context

NestJS 11, TypeScript 6, Prisma/PostgreSQL, an interval worker with `FOR UPDATE SKIP LOCKED` claims for the renewal job (the voucher reconcile pattern; no BullMQ queue), existing outbox,
audit, notifications and system configuration. No new dependency and no shared-package change.

## Module design

```
src/modules/subscriptions/
  domain/          plan-entitlements.ts (zod schema, FREE defaults), subscription.policy.ts
                   (period start, proration, transitions), subscription.permissions.ts
  application/
    contracts/     subscription-entitlements.ts (exported reader types)
    services/      subscription-plans.service.ts, subscriptions.service.ts (purchase, upgrade,
                   patch, add-on), subscription-renewal.service.ts,
                   subscription-entitlements.reader.ts
  infrastructure/  jobs/subscription-renewal.worker.ts
  presentation/    http/subscriptions.controller.ts, admin-subscriptions.controller.ts, DTOs
```

- `credit` adds `CreditOperationsService.chargeSubscription(tx, { chargeId, userId, amount })`,
  mirroring `redeemVoucher` (wallet lock, `spendOldestFirst`, one ledger entry).
- `SubscriptionEntitlementsReader.forUser(tx, userId, at)` returns `{ planCode | "FREE",
subscriptionId | null, entitlements }`; `forUsers` resolves several users with one query.
  `ACTIVE` and `GRACE` both grant entitlements; `termEnd <= at` without renewal counts as expired
  even before the job runs.
- Fee pinning: `pinSettlementFee` (learning paths) and `activeFeePolicy` (materials) take a
  `feeTier` and look up `<BASE>_<TIER>` first, then the base code. Settlement validation in
  `CreditLedgerService` maps a tier code to its base before comparing with the exchange type.

## Transactions and locking

- Purchase, upgrade and add-on: one transaction. Lock order: user subscription advisory lock
  (`subscription:<userId>`), then wallet (`lockWallet`). Insert charge + operation + ledger +
  subscription change + outbox together.
- Renewal job: claims due rows with `FOR UPDATE SKIP LOCKED` and a 5-minute lease, then
  processes each row in its own transaction with the same lock order. It re-reads the row under
  the owner lock, so a repeated run for the same term end is a no-op; the charge key
  `renewal:<subscriptionId>:<termEnd>` is unique per user as a second guard. The job owns every
  term-end transition; user routes answer `409 SUBSCRIPTION_RENEWAL_PENDING` until it has run.
- Recording minutes: `chargeRecordingMinutes` runs inside the `egress_ended` consumer
  transaction, guarded by `charged_minutes IS NULL` with a conditional update.
- Material storage: owner advisory lock, sum `sizeBytes`, compare, then attach.
- No external call happens inside these transactions.

## Constitution Check

| Principle                  | Status         | Evidence / note                                                                                                        |
| -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 Modular monolith         | Pass (planned) | New module with domain/application/infrastructure/presentation; consumers use the exported reader.                     |
| 2 Stores                   | Pass (planned) | All state in PostgreSQL.                                                                                               |
| 3 Atomic finance           | Pending        | Integer hundredths, idempotency keys, one operation per charge; needs real-DB concurrency tests (T030).                |
| 4 Auth                     | Pass (planned) | New permission codes and role maps; self routes act only on the caller.                                                |
| 5 Validation and contracts | Pending        | DTOs, Swagger, config schema; T012/T013.                                                                               |
| 6 Verification             | Pending        | Lint, check-types, build, behavioral suites per phase.                                                                 |
| 7 Ownership                | Pass (planned) | Credit writes stay in `credit`; recording/whiteboard columns written by `learning-sessions`; materials by `materials`. |
| 8 Jobs and events          | Pending        | Renewal job idempotent per term; outbox events after commit; duplicate webhook test for minutes.                       |

## Phases

1. Foundation: schema, migration, config keys, permissions, domain policy.
2. Core: plans admin, purchase, `me` read, patch, upgrade, charges, entitlement reader.
3. Renewal job, grace, expiry, events and notifications.
4. Fee tiers (learning paths, materials, fee-policy admin, settlement mapping).
5. Whiteboard retention snapshot (spec 019 amendment).
6. Recording entitlement, minutes, add-on and retention snapshot (spec 020 amendment).
7. Material storage quota (after Q3/Q4).

## Risks

- Changing the settlement policy-code check touches the most sensitive financial path; keep
  the change to a code-mapping helper with direct tests, and keep the rate-snapshot check.
- Prorated upgrade arithmetic must use BigInt and floor; test term boundaries.
- Retention snapshots change which rows the sweep deletes; legacy rows (null snapshot) must keep
  today's behaviour.

## Complexity Tracking

No constitution exceptions.
