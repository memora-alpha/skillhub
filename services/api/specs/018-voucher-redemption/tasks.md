# Tasks: Voucher Redemption

## Phase 1 — Schema and foundation

- [x] T001 Add `prisma/voucher-support.prisma` (RewardBrand, RewardProduct, VoucherRedemption, IssuedVoucher, new enums) per data-model.md
- [x] T002 Extend `scripts/generate-runtime-schema.mjs`: append voucher-support, add `VOUCHER_REDEMPTION` to CreditTransactionType and CreditReferenceType
- [x] T003 Regenerate schema/client; create migration with CHECK constraints and indexes
- [x] T004 Add env validation for `VOUCHER_*`; refuse `mock` provider in production
- [x] T005 Add SystemConfiguration keys + seeds (limits, budget, max attempts)
- [x] T006 Add permissions `reward:redeem`, `reward:manage` and audit actions

## Phase 2 — Credit

- [x] T010 `CreditOperationsService.redeemVoucher()` spending lots of any source, oldest first
- [x] T011 `CreditOperationsService.refundVoucher()` compensating entries to the same lots
- [x] T012 DB integration tests: mixed-source oldest-first spend, per-lot refund, refund nets to zero, concurrent debits (needs migration applied)

## Phase 3 — Rewards module core

- [x] T020 VoucherProvider port, contracts, ProviderError
- [x] T021 VoucherSecretCipher (AES-256-GCM, key version) + tests
- [x] T022 Redemption policy: state machine, eligibility, limits + unit tests
- [x] T023 RedemptionService: redeem (Tx1), issue, finalize (Tx2), refund
- [x] T024 Reconcile worker (DB-polled interval, SKIP LOCKED, backoff, MANUAL_REVIEW)
- [x] T025 Catalog sync service + worker (upsert, new = INACTIVE, missing = REMOVED)

## Phase 4 — Mock provider

- [x] T030 Mock catalog (fictional Demo brands for scenario tests, scenario suffixes) plus the real-brand reward catalog in `data/reward-catalog.json` (49 brands, 113 products from gotit.vn; face values and prices are demo assumptions)
- [x] T031 MockVoucherProvider with in-memory issue state
- [x] T032 Seed script `pnpm db:seed-rewards [--activate]` (sync the mock catalog; `--activate` prices and activates unpriced catalog products at 1.000 VND = 1 Credit; refuses unless `APP_DEPLOYMENT_TIER` is local or staging)

## Phase 5 — HTTP

- [x] T040 User endpoints `/rewards/*` + DTOs/responses + Swagger
- [x] T041 Admin endpoints `/admin/rewards/*` + DTOs/responses + Swagger
- [ ] T042 Notifications on ISSUED / FAILED_REFUNDED / MANUAL_REVIEW

## Phase 6 — Verification

- [x] T050 DB integration tests for every US2/US3 scenario (each mock suffix)
- [x] T051 Idempotency replay and key-reuse tests
- [x] T052 Ownership (404 for other user) and audit-on-reveal tests
- [x] T053 lint, check-types, build; write validation.md with results

## Phase 7 — Got It adapter (after onboarding, Q8 answered)

- [ ] T060 HTTP client: `X-GI-Authorization`, RSA-SHA256 signing, RSA decrypt
- [ ] T061 Map Got It products/brands and error codes to DEFINITIVE/UNKNOWN
- [ ] T062 `findByClientRef` via `vouchers/multiple/status`
- [ ] T063 Mirror images to SkillHub storage
- [ ] T064 Run Got It staging testcases; record results

## Later (separate tasks)

- Web admin screens (`apps/web`), mobile catalog/redeem/wallet screens (`apps/mobile`)
- Production enablement after Q1, Q2, Q6

## Implementation notes (2026-11-20)

- Done and unit-tested (`pnpm test:rewards`, 11 tests): policy, cipher, mock provider, env guards, redemption orchestration with fakes.
- Deviations from plan.md: the reconcile worker polls the DB with `setInterval` like `PaymentCheckoutWorker` (no BullMQ); mock issue state is in memory, not Redis; the public product list is unpaginated (max 200); notifications (T042) not started.
- Migration `20261120000000_voucher_redemption` is applied to the local dev database. `test/rewards/rewards.integration.test.mjs` (10 cases, isolated schema) covers T012, T050–T052; it caught a mangled audit regex. Run with `TEST_DATABASE_URL` set via `pnpm test:rewards:integration`.
