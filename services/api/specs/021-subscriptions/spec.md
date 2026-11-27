# Feature Specification: Subscriptions

**Feature Branch**: `feat/subscriptions`

**Created**: 2026-11-27

**Status**: Draft. Decisions D1–D14 are the defaults agreed in the product discussion of
2026-11-23 to 2026-11-27. Values marked "default" in [policies.md](policies.md) still need
Product Owner approval. The feature ships dark: `subscription.enabled` defaults to `false`.

**Scope**: Backend only (`services/api`). Web and mobile UI, store billing (IAP) and
marketing copy are out of scope.

**Release gates** (before turning `subscription.enabled` on in production, not before coding):

- Amend the SRS. SRS 1.7 has no subscription, plan or entitlement concept, and fixes the
  ONE_WAY fee at 4%. Record the amendment in `docs/SOURCE_OF_TRUTH.md`.
- Approve every value in [policies.md](policies.md), including the fee policy versions.
- Decide OP-04 (file retention) before Phase 4 (material storage quota).
- Get a LiveKit Egress quote, to confirm recording minutes per plan (Q6).

## Purpose

A subscription is a recurring Credit purchase that unlocks convenience, tooling and better
economics for active teachers and material sellers. It gives earned Credit, which cannot be
cashed out, a place to be spent. It never sells trust or the right to teach or learn.

## Current-state findings

- Credit: wallet, lots by source (`PURCHASED`, `EARNED`, `BONUS`), ledger, `CreditOperation`
  idempotency and `CreditProvenanceService.spendOldestFirst` exist in `src/modules/credit`.
  `CreditOperationsService.redeemVoucher` is the closest precedent for a one-entry debit.
  Amounts are BigInt hundredths (100 units = 1 Credit).
- Fees: `FeePolicyVersion` holds versioned, approved policies `ONE_WAY` (400 bps),
  `TWO_WAY` (400 bps) and `MATERIAL_PAID` (500 bps). `FeePolicyAdminService` manages them and
  notifications announce changes.
  - Learning paths pin `feePolicyId` and `feeRateSnapshot` when the schedule is locked
    (`LearningPathsService.pinSettlementFee`). `CreditLedgerService` settlement rejects a policy
    whose `policyCode` differs from the exchange type, or whose rate differs from the snapshot.
  - Material orders pick the effective `MATERIAL_PAID` policy at purchase time and store
    `feePolicyId` and `feeSnapshot` (`material-purchase.service.ts`).
- Whiteboard (spec 019): one `SessionWhiteboard` per Session. The retention worker reads the
  global `whiteboard.retentionDays` (default 30, min 8) at sweep time. Rows carry no retention.
- Recording (spec 020, merged, dark): `SessionRecording` with consent, legal hold and deletion.
  Retention reads the global `recording.retentionDays` (default 90) at read and sweep time.
  D9 states "the platform pays" and every participant may request a recording.
- Materials: each material stores `sizeBytes`. No per-user total storage limit exists.
- Configuration: `SystemConfiguration` with a typed catalog
  (`configuration.catalog.ts`), versions and `effectiveAt`.
- Permissions: `PermissionCode` catalog plus per-module `*_PERMISSIONS` role maps.

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Plans.** Two paid plans in V1: `CREATOR` and `PRO`. Everyone else is `FREE`, which is the absence of an active subscription, not a row. `LEARNER_PLUS` is deferred.                                                                                                                                                                                                                                                                                                                                                  |
| D2  | **Never in a plan.** Learning and exchange (TWO_WAY/ONE_WAY), teaching hours, sessions per path, Skill Evidence, reports, disputes, Reputation and Recovery, makeup and reschedule limits, OTP, cooldowns and rate limits. A plan never changes how a report or dispute is decided.                                                                                                                                                                                                                                    |
| D3  | **Payment.** Credit only, from any lot source, oldest lot first, like vouchers (spec 018 D3). One `CreditOperation` and one `SUBSCRIPTION_PURCHASE` ledger entry per charge, with an `Idempotency-Key`. No VND payment path.                                                                                                                                                                                                                                                                                           |
| D4  | **Terms and periods.** Billing interval `MONTH` (30 days) or `YEAR` (365 days). Usage allowances reset every 30-day period inside the term, counted from the term start. Times are UTC.                                                                                                                                                                                                                                                                                                                                |
| D5  | **Plan versions.** Prices and entitlements live in versioned `SubscriptionPlanVersion` rows (draft, approved, retired, `effectiveAt`), like fee policies. A subscription snapshots its version; a price change applies at the next renewal, never to a paid term.                                                                                                                                                                                                                                                      |
| D6  | **Renewal.** Auto-renew is on by default and can be switched off. At term end a job charges the current approved version. If Credit is short, the subscription enters `GRACE` for `subscription.graceDays` (default 3) with daily retries and keeps its entitlements, then becomes `EXPIRED`.                                                                                                                                                                                                                          |
| D7  | **Cancel, upgrade, downgrade.** Cancel switches auto-renew off; the plan stays until term end; no Credit is refunded. Upgrade (`CREATOR` → `PRO`) takes effect at once for the prorated difference: `floor((newPrice − oldPrice) × remainingSeconds / termSeconds)`, term end unchanged. The current period's recording allowance rises to the new plan at once; minutes already used stay used (decided 2026-11-27). Downgrade or interval change is scheduled for the next renewal.                                  |
| D8  | **Fee discount.** New fee policy codes `ONE_WAY_CREATOR`, `ONE_WAY_PRO`, `MATERIAL_PAID_CREATOR`, `MATERIAL_PAID_PRO`, versioned and approved through the existing fee-policy admin. ONE_WAY uses the **teacher's** plan when the schedule is locked and the fee is pinned; the pinned rate holds until settlement whatever happens to the plan. Material sales use the **seller's** plan at purchase time. TWO_WAY always uses `TWO_WAY`.                                                                             |
| D9  | **Material storage.** Total `sizeBytes` of a user's materials that are not removed must stay within the plan allowance. The check runs under the owner's lock when a material file is attached; replacing a material's file leaves its old file out of the total, and archived materials still count. It applies only while `subscription.enabled` is on, because with plans off nobody can buy more space. The 15 MB per-file limit stays. Chat, evidence, report and avatar files never count. Phase 4, after OP-04. |
| D10 | **Whiteboard retention.** Each save sets the board's `retentionDays` snapshot to the highest of its current value and both participants' plan values at that moment. It never decreases, and it stops changing when the edit window closes (spec 019 P1), so it is frozen before any sweep. The worker uses the snapshot, and the global config only for legacy rows without one. Free keeps today's 30 days.                                                                                                          |
| D11 | **Recording entitlement.** Amends spec 020 D2 and D9. Only a participant with an active plan that includes recording may **request** one. The other participant still has to accept and keeps equal viewing and deletion rights. Minutes are charged to the requester at `egress_ended`, `ceil(durationMs / 60000)`. A request needs at least 1 remaining minute. A recording in progress always finishes; minutes over the allowance are absorbed by the platform, not carried over.                                  |
| D12 | **Recording retention.** Amends spec 020 D6. The recording stores a `retentionDays` snapshot from the requester's plan when it starts. Legal hold (open report) still overrides it.                                                                                                                                                                                                                                                                                                                                    |
| D13 | **Expiry and downgrade.** Blocks new use only, never deletes. Stored data keeps the retention it got at creation. Materials over the new storage allowance stay published and downloadable; new uploads are refused until usage is under the allowance.                                                                                                                                                                                                                                                                |
| D14 | **Recording add-on minutes.** Packs of 60 minutes for 30 Credit (default), sold only to users with an active plan that includes recording. Add-on minutes are spent after the period allowance and expire with the term.                                                                                                                                                                                                                                                                                               |

## User Scenarios & Testing

### US1 — Browse plans (P1)

An authenticated user lists the approved, effective plan versions with prices per interval
and entitlements.

**Independent test**: draft and retired versions never appear; a version with a future
`effectiveAt` does not appear yet.

### US2 — Subscribe with Credit (P1)

A Free user buys `CREATOR` or `PRO` with `Idempotency-Key`, `billingInterval` and
`expectedPlanVersionId`. The response returns the active subscription.

**Independent test**:

- Available Credit decreases by exactly the price, oldest lots first, any source.
- Same key replayed → same subscription, single debit. Same key, other body →
  `IDEMPOTENCY_KEY_REUSED`.
- Stale plan version → `SUBSCRIPTION_PLAN_CHANGED`, no debit.
- Insufficient Credit → `INSUFFICIENT_AVAILABLE_CREDIT`, no debit.
- Already active or in grace → `SUBSCRIPTION_ALREADY_ACTIVE`.
- Two concurrent purchases → exactly one succeeds.
- `subscription.enabled = false` → `SUBSCRIPTIONS_DISABLED`.

### US3 — Renewal, grace and expiry (P1)

**Independent test**:

- Auto-renew on and enough Credit → charged once at term end, new term, usage reset.
- Short Credit → `GRACE`, entitlements kept, retried daily; Credit topped up → renewed with
  the term starting at the original term end; grace elapsed → `EXPIRED`.
- Auto-renew off → `EXPIRED` at term end with no charge.
- The job running twice or concurrently for one subscription charges once.
- A scheduled downgrade or interval change applies at renewal, with the new price.

### US4 — Change plan (P1)

**Independent test**:

- Upgrade charges the prorated difference once and switches entitlements immediately.
- Upgrade with a stale quote → `SUBSCRIPTION_QUOTE_CHANGED`, no debit.
- Downgrade and cancel change nothing until term end; cancel can be undone before term end by
  switching auto-renew back on.

### US5 — Fee discount (P1)

**Independent test**:

- ONE_WAY schedule locked while the teacher is on `PRO` → pinned `ONE_WAY_PRO` rate; the plan
  expires before settlement → settlement still uses the pinned rate.
- ONE_WAY locked while the teacher is Free → `ONE_WAY`, even if the teacher subscribes later.
- TWO_WAY → always `TWO_WAY`.
- Material purchase from a `CREATOR` seller → `MATERIAL_PAID_CREATOR` snapshot on the order.
- A missing approved tier policy falls back to the base policy and never blocks the flow.

### US6 — Whiteboard retention (P2)

**Independent test**: board of a Free and a `PRO` participant → snapshot 365 days; both Free →
30; legacy row without snapshot → global config; open report → held regardless.

### US7 — Recording entitlement (P2)

**Independent test**:

- Free requester → `RECORDING_PLAN_REQUIRED`; the partner on a plan may request instead.
- Zero remaining minutes and no add-on → `RECORDING_MINUTES_EXHAUSTED`.
- `egress_ended` delivered twice → minutes charged once.
- A recording exceeding the remaining minutes finishes; usage is capped at the allowance.
- Plan expires after recording → the recording keeps its retention snapshot.

### US8 — Material storage quota (P3, after OP-04)

**Independent test**: attaching a file that would exceed the allowance →
`MATERIAL_STORAGE_QUOTA_EXCEEDED`; two concurrent attaches near the limit → at most one
succeeds; downgrade over quota → existing materials untouched, new attach refused.

### US9 — Admin (P2)

Staff or Admin with `subscription:manage` drafts, approves and retires plan versions, lists
subscriptions by status and plan, and reads one user's charges. Every change writes audit.

## Out of scope

`LEARNER_PLUS`, free trial, whiteboard export, teacher analytics, LearningPlan templates,
promoted listings and material vouchers (each needs its own spec), Credit refunds of
subscription charges (Staff use the existing adjustment flow), session-count limits per
path (deferred 2026-11-27), web/mobile UI and store billing.
