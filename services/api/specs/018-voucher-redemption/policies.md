# Voucher Redemption — Policies and Open Questions

Defaults below let the demo run. They are not approved production policy.

| ID  | Question                                                                                                                           | Owner      | Demo default                           | Blocks     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------- | ---------- |
| Q1  | Is voucher redemption an approved exception to SRS 1.7 §18.17 (no cash-out)? Requires SRS amendment?                               | PO         | Feature flag off; staging/demo only    | Production |
| Q2  | Which Credit buckets are eligible: purchased, bonus, earned (teaching)?                                                            | PO         | Answered 2026-11-23: all, oldest first | —          |
| Q3  | Credit price per voucher: 1.000 VND = 1 Credit, or with margin/discount?                                                           | PO         | Admin sets `priceCredit` per product   | —          |
| Q4  | Per-user daily limit and platform budget values                                                                                    | PO         | 500 Credit/user/day; 5.000.000 VND/day | —          |
| Q5  | Refund after issuance or on expiry?                                                                                                | PO         | Never after `ISSUED`                   | —          |
| Q6  | Accounting, invoices and promotion/legal treatment                                                                                 | PO/Finance | Out of scope                           | Production |
| Q7  | Model A (on-demand) vs B (inventory) vs mixed                                                                                      | PO         | A only                                 | —          |
| Q8  | Got It: billing model (prepaid/postpaid), balance API, exact product/voucher response fields, error codes, testcases, IP whitelist | Got It     | —                                      | Phase 2    |

## Fixed rules (implementation)

- Every debit/refund is a `CreditOperation` + ledger entries; history is never edited.
- Unknown provider outcome is never auto-refunded.
- Voucher secrets are never logged and are returned only by the owner-detail endpoint.
- Mock vouchers are worthless. The reward catalog (`data/reward-catalog.json`) uses real brand names and logo URLs from gotit.vn, as decided by the project owner; the scenario-test brands stay fictional. Mock codes keep the `DEMO-` prefix. `db:seed-rewards` refuses to run unless `APP_DEPLOYMENT_TIER` is local or staging, and the mock provider is refused in production.
