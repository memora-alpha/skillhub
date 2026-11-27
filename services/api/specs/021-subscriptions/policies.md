# Subscriptions — Policies and Open Questions

Defaults below let development and staging run. They are not approved production policy.
Credit values are whole Credit; storage stores them as hundredths.

## Plan values (default, Q1)

| Entitlement                         | FREE               | CREATOR                    | PRO                    |
| ----------------------------------- | ------------------ | -------------------------- | ---------------------- |
| Price per MONTH term (Credit)       | 0                  | 99                         | 299                    |
| Price per YEAR term (Credit)        | 0                  | 950                        | 2.870                  |
| ONE_WAY fee (fee policy code)       | 4% `ONE_WAY`       | 3% `ONE_WAY_CREATOR`       | 2% `ONE_WAY_PRO`       |
| Material sale fee (fee policy code) | 5% `MATERIAL_PAID` | 4% `MATERIAL_PAID_CREATOR` | 3% `MATERIAL_PAID_PRO` |
| Material storage                    | 1 GB               | 10 GB                      | 50 GB                  |
| Whiteboard retention (days)         | 30                 | 180                        | 365                    |
| Recording minutes per 30-day period | 0                  | 120                        | 400                    |
| Recording retention (days)          | —                  | 30                         | 90                     |
| Recording add-on                    | —                  | 60 min / 30 Credit         | 60 min / 30 Credit     |

GB means 10^9 bytes. TWO_WAY stays at 4% `TWO_WAY` on every plan.

## Configuration keys

| Key                              | Type / range                                | Default                   |
| -------------------------------- | ------------------------------------------- | ------------------------- |
| `subscription.enabled`           | boolean                                     | `false`                   |
| `subscription.graceDays`         | int 0–14                                    | 3                         |
| `subscription.renewalRetryHours` | int 1–72                                    | 24                        |
| `subscription.recordingAddon`    | `{minutes, priceCredit}` positive ints      | `{60, 30}`                |
| `subscription.freeEntitlements`  | object, same shape as a plan's entitlements | values in the FREE column |

## Open questions

| ID  | Question                                                                                                                                               | Owner      | Default                                                              | Blocks         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------- | -------------- |
| Q1  | Approve prices and entitlement values above.                                                                                                           | PO         | Table above                                                          | Production     |
| Q2  | SRS amendment: subscriptions, tiered fees (SRS fixes ONE_WAY at 4%), recording as a paid feature.                                                      | PO         | Feature flag off                                                     | Production     |
| Q3  | Material storage applies a new 1 GB Free limit. Existing users above it keep their materials (D13); is that acceptable, or should Free stay unlimited? | PO         | 1 GB, existing data kept (implemented as the default, Phase 7)       | Phase 4        |
| Q4  | OP-04 file retention, which defines when removed material files stop counting.                                                                         | PO         | Removed materials stop counting at once (implemented, Phase 7)       | Phase 4        |
| Q5  | Refunds of subscription charges (error, dispute, account closure).                                                                                     | PO/Finance | None; Staff use the existing Credit adjustment with reason and audit | —              |
| Q6  | LiveKit Egress cost per minute, to confirm minutes per plan.                                                                                           | Ops        | 120 / 400                                                            | Production     |
| Q7  | Accounting and invoice treatment of Credit spent on subscriptions.                                                                                     | Finance    | Out of scope                                                         | Production     |
| Q8  | Store billing (IAP) if a mobile client sells plans.                                                                                                    | PO         | Backend is client-neutral                                            | Mobile release |

## Changes from the discussion summary (2026-11-27)

- Fee is pinned when the schedule is locked, not at final settlement, because the existing
  settlement already validates a rate snapshot taken at that point (spec 009/learning paths).
- Material sale fee starts from the existing 5% `MATERIAL_PAID` policy, so the tiers are 4% and
  3%, not 3% and 2%.
- Recording overrun is absorbed, not carried into the next period: one recording is bounded by
  the Session length plus `recording.overrunMinutes` (spec 020 D3), so carrying debt adds
  complexity for a small amount.
- Add-on minutes are sold only to subscribers in V1.
- Whiteboard export is dropped: Excalidraw exports PNG/SVG locally in the client, so a server
  gate adds nothing.

## Fixed rules (implementation)

- Every charge is one `CreditOperation` plus ledger entries; history is never edited.
- A subscription row never holds a balance; entitlements are derived, never stored as Credit.
- Entitlement checks read inside the caller's transaction, so a purchase or expiry is either
  fully visible or not visible to the check.
- A plan never relaxes a legal hold, consent rule or permission check.
