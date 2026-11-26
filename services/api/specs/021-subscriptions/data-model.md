# Subscriptions — Data Model

New models live in `prisma/subscription-support.prisma`, appended by
`scripts/generate-runtime-schema.mjs` like `voucher-support.prisma`. Do not edit
`schema.prisma` directly. Credit amounts use BigInt, 100 units = 1 Credit.

## Enum additions (generator overlay)

- `CreditTransactionType`: `SUBSCRIPTION_PURCHASE`
- `CreditReferenceType`: `SUBSCRIPTION_CHARGE`
- New `SubscriptionPlanCode`: `CREATOR`, `PRO`
- New `SubscriptionInterval`: `MONTH`, `YEAR`
- New `SubscriptionPlanStatus`: `DRAFT`, `APPROVED`, `RETIRED`
- New `SubscriptionStatus`: `ACTIVE`, `GRACE`, `EXPIRED`
- New `SubscriptionChargeKind`: `PURCHASE`, `RENEWAL`, `UPGRADE`, `RECORDING_ADDON`

Fee policy codes are a string column; add `ONE_WAY_CREATOR`, `ONE_WAY_PRO`,
`MATERIAL_PAID_CREATOR`, `MATERIAL_PAID_PRO` to the allowed vocabulary in
`FeePolicyAdminService`, its DTOs, responses and the fee-policy notification handler.

## SubscriptionPlanVersion — `subscription_plan_versions`

| Field                | Type                   | Notes                                 |
| -------------------- | ---------------------- | ------------------------------------- |
| id                   | uuid PK                |                                       |
| planCode             | SubscriptionPlanCode   |                                       |
| versionNo            | int                    | unique with planCode                  |
| monthPrice           | bigint                 | > 0, hundredths                       |
| yearPrice            | bigint                 | > 0, hundredths                       |
| entitlements         | jsonb                  | validated by `planEntitlementsSchema` |
| status               | SubscriptionPlanStatus | default DRAFT                         |
| effectiveAt          | timestamptz?           | required when APPROVED                |
| approvedAt           | timestamptz?           |                                       |
| approvedByUserId     | uuid? FK User          |                                       |
| createdByUserId      | uuid FK User           |                                       |
| createdAt, updatedAt | timestamptz            |                                       |

`entitlements`: `{ feeTier: "CREATOR"|"PRO", materialStorageBytes: string, whiteboardRetentionDays: int,
recordingMinutesPerPeriod: int, recordingRetentionDays: int, recordingAddonAllowed: boolean }`.

Checks: `status = APPROVED ⇒ effectiveAt IS NOT NULL AND approvedAt IS NOT NULL`. An approved row is immutable;
a change is a new version. The effective version of a plan is the APPROVED row with the latest
`effectiveAt <= now`, ties broken by `versionNo`.

## UserSubscription — `user_subscriptions`

| Field                         | Type                  | Notes                  |
| ----------------------------- | --------------------- | ---------------------- |
| id                            | uuid PK               |                        |
| userId                        | uuid FK User          |                        |
| planCode                      | SubscriptionPlanCode  | current plan           |
| planVersionId                 | uuid FK PlanVersion   | snapshot for this term |
| interval                      | SubscriptionInterval  |                        |
| status                        | SubscriptionStatus    |                        |
| autoRenew                     | boolean               | default true           |
| termStart, termEnd            | timestamptz           | `termEnd > termStart`  |
| graceUntil                    | timestamptz?          | set on entering GRACE  |
| nextRenewalAttemptAt          | timestamptz?          | job schedule           |
| scheduledPlanCode             | SubscriptionPlanCode? | applied at renewal     |
| scheduledInterval             | SubscriptionInterval? | applied at renewal     |
| version                       | int                   | optimistic concurrency |
| createdAt, updatedAt, endedAt | timestamptz           |                        |

Partial unique index: one row per `userId` with `status IN ('ACTIVE','GRACE')`. An expired row stays as history;
re-subscribing creates a new row.
Indexes: `(status, nextRenewalAttemptAt)`, `(userId, createdAt desc)`.

Period start for usage = `termStart + floor((now − termStart) / 30 days) × 30 days`. The last period of a
`YEAR` term is 5 days long and still gets the full allowance.

## SubscriptionCharge — `subscription_charges`

| Field          | Type                    | Notes                                                                               |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| id             | uuid PK                 | `CreditOperation.referenceId`                                                       |
| subscriptionId | uuid FK                 |                                                                                     |
| userId         | uuid FK                 |                                                                                     |
| kind           | SubscriptionChargeKind  |                                                                                     |
| planVersionId  | uuid FK PlanVersion     |                                                                                     |
| amount         | bigint                  | > 0                                                                                 |
| quantity       | int                     | add-on packs; 1 otherwise                                                           |
| operationId    | uuid FK CreditOperation | unique                                                                              |
| idempotencyKey | varchar(255)            | unique `(userId, key digest)`; job charges use `renewal:<subscriptionId>:<termEnd>` |
| requestDigest  | char(64)                | detects key reuse with another body                                                 |
| createdAt      | timestamptz             |                                                                                     |

Index: `(userId, createdAt desc, id desc)`.

## SubscriptionUsage — `subscription_usage`

| Field                   | Type           | Notes                                |
| ----------------------- | -------------- | ------------------------------------ |
| subscriptionId          | uuid PK/FK     |                                      |
| periodStart             | timestamptz PK |                                      |
| recordingMinutesAllowed | int            | snapshot of the plan at period start |
| recordingMinutesUsed    | int            | `>= 0`, capped at allowed + add-on   |
| addonMinutesRemaining   | int            | `>= 0`; purchased packs for the term |
| updatedAt               | timestamptz    |                                      |

Add-on minutes carry across periods inside a term: the next period row copies `addonMinutesRemaining`.

## Columns on existing tables

| Table                 | Column            | Type     | Notes                                                       |
| --------------------- | ----------------- | -------- | ----------------------------------------------------------- |
| `session_whiteboards` | `retention_days`  | int?     | D10 snapshot raised on each save; null = legacy, use config |
| `session_recordings`  | `retention_days`  | int?     | D12 snapshot at start; null = legacy, use config            |
| `session_recordings`  | `charged_minutes` | int?     | set once at `egress_ended`; non-null = already charged      |
| `session_recordings`  | `subscription_id` | uuid? FK | subscription charged                                        |

## Ownership

- `subscriptions` owns the four new tables and exports `SubscriptionEntitlementsReader`
  (`forUser`, `forUsers`, `chargeRecordingMinutes`) for other modules.
- `credit` keeps owning wallets, lots, operations and fee policies; it exports a
  `chargeSubscription(tx, …)` operation like `redeemVoucher`.
- `learning-sessions` and `materials` write their own columns, calling the reader inside their
  transaction.
