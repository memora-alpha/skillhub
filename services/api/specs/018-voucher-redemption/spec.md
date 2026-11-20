# Feature Specification: Voucher Redemption

**Feature Branch**: `feat/voucher-redemption`

**Created**: 2026-11-20

**Status**: Approved for demo implementation (mock provider). Production enablement
blocked on Q1 in [policies.md](policies.md).

**Input**: User research on T-Plus Gift and Got It Biz API; decision to build a mock
provider first behind the same provider port used later by Got It.

## Business constraint

SRS 1.7 §18.17 states Credit is used only inside SkillHub and is not converted back to
money; enabling cash-out requires a separate SRS version and KYC/legal review. A voucher
with external purchasing value may fall under that rule. Until the Product Owner records
an amendment (Q1), the feature ships behind `VOUCHER_REDEMPTION_ENABLED=false` and the
mock provider is refused when `NODE_ENV=production`.

## Current-state findings

- Credit wallet, lots (`purchased`/`bonus` provenance), ledger and idempotent operations
  exist in `src/modules/credit`. `MaterialPurchaseService` is the closest precedent for
  spending Credit inside one transaction.
- `PaymentGateway` (payOS) is the precedent for an external provider port + adapter.
- BullMQ (`QueueModule`), outbox, audit and notifications exist.
- No reward catalog, redemption or voucher models exist.

## Decisions

| ID  | Decision                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | On-demand issuance only (model A). No pre-purchased voucher inventory.                                                                                                                               |
| D2  | One `VoucherProvider` port; adapters `mock` (this spec) and `gotit` (phase 2). Selected by `VOUCHER_PROVIDER`.                                                                                       |
| D3  | Only `purchasedCredit` lots can pay for a voucher (default for Q2).                                                                                                                                  |
| D4  | Synced products start inactive with no price; an admin sets `priceCredit` and activates. Provider price is never used as the Credit price.                                                           |
| D5  | Issued voucher keeps a snapshot (name, brand, image, face value, terms, expiry). Code/PIN/link are encrypted at rest (AES-256-GCM, `VOUCHER_SECRET_KEY`).                                            |
| D6  | Provider call runs outside the debit transaction. Definitive failure → compensating refund. Unknown outcome (timeout/5xx) → no refund; reconcile by `clientRef`; after N attempts → `MANUAL_REVIEW`. |
| D7  | Catalog stores provider image URLs. Copying images to SkillHub storage is deferred to the Got It phase. Mock data uses fictional brands and placeholder images only.                                 |
| D8  | Per-user daily Credit limit and platform daily budget (VND face value) are `SystemConfiguration` keys.                                                                                               |

## User Scenarios & Testing

### US1 — Browse reward catalog (P1)

An authenticated user lists active, priced products grouped by brand/category with name,
brand, image, face value, `priceCredit`, terms and validity.

**Independent test**: inactive or unpriced products never appear; locale `vi`/`en`
selects the matching text, falling back to `vi`.

### US2 — Redeem Credit for a voucher (P1)

The user redeems a product with `Idempotency-Key` and `expectedPriceVersion`. On success
the response returns the redemption in `ISSUED` with voucher details.

**Independent test**:

- Balance decreases by exactly `priceCredit`, only from purchased lots.
- Same key replayed → same redemption, single debit; same key with another product → `IDEMPOTENCY_KEY_REUSED`.
- Stale price version → `REWARD_PRICE_CHANGED`, no debit.
- Insufficient purchased Credit, inactive product, user/platform limit exceeded → rejected, no debit.
- Two concurrent redemptions exceeding balance → exactly one succeeds.

### US3 — Provider failures (P1)

- Out of stock / invalid product (definitive) → `FAILED_REFUNDED`; ledger nets to zero.
- Timeout then provider later reports success → reconcile job moves to `ISSUED`, no refund.
- Unknown outcome beyond max attempts → `MANUAL_REVIEW`; no automatic refund.

**Independent test**: one mock product per scenario.

### US4 — My vouchers (P1)

User lists own redemptions (cursor pagination, newest first) and opens one to reveal the
code. Revealing writes an audit entry. Another user's redemption returns 404.

### US5 — Admin operations (P2)

Staff/Admin with permission:

- list/filter redemptions by status, user, product, date;
- trigger catalog sync; set `priceCredit`, activate/deactivate, sort order, display overrides;
- resolve `MANUAL_REVIEW`: mark issued (attach voucher) or refund, with mandatory reason + audit;
- view daily issued face value vs budget.

## Out of scope

Pre-purchased inventory, sending vouchers by SMS/email via provider, Got It adapter
(phase 2, separate tasks), web/mobile UI, image mirroring, production enablement.
