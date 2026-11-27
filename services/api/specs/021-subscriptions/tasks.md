# Tasks: Subscriptions

## Gates

- [x] G1 Scope: backend only; teaching-hour and session-per-path limits excluded (2026-11-27)
- [x] G2 Decisions D1–D14 accepted as defaults for implementation (2026-11-27)
- [ ] G3 PO approval of plan values (policies Q1)
- [ ] G4 SRS amendment (Q2), before turning `subscription.enabled` on in production
- [ ] G5 Q3/Q4 decided, before Phase 7
- [ ] G6 LiveKit Egress quote (Q6), before production

## Phase 1 — Foundation

- [x] T001 `prisma/subscription-support.prisma`, enum overlays and back-relations in `scripts/generate-runtime-schema.mjs`
- [x] T002 Migration: tables, CHECKs, partial unique index for ACTIVE/GRACE per user, new columns on `session_whiteboards` and `session_recordings`
- [x] T003 Config keys `subscription.enabled`, `.graceDays`, `.renewalRetryHours`, `.recordingAddon`, `.freeEntitlements` (+ configuration test)
- [x] T004 Permissions `subscription:manage:self`, `subscription:read`, `subscription:manage` and role maps (+ access test)
- [x] T005 `domain/plan-entitlements.ts` and `domain/subscription.policy.ts`: period start, proration, transitions, with unit tests

## Phase 2 — Core

- [x] T006 `CreditOperationsService.chargeSubscription` with ledger type `SUBSCRIPTION_PURCHASE`
- [x] T007 Plan versions admin: create draft, approve, retire, list; audit
- [x] T008 `SubscriptionEntitlementsReader` (`forUser`, `forUsers`)
- [x] T009 Purchase with idempotency, plan-version check, lock order
- [x] T010 `GET /me/subscription`, `PATCH /me/subscription`, charges list
- [x] T011 Upgrade quote and upgrade
- [x] T012 Controllers, DTOs, Swagger, exception filter allowlist
- [x] T013 Tests: purchase replay/key reuse, stale version, insufficient Credit, concurrent purchase, disabled flag, upgrade proration and stale quote, patch clearing

## Phase 3 — Renewal

- [x] T014 Renewal service and interval worker (SKIP LOCKED claims, like the voucher reconcile worker): renew, grace, retry, expire, scheduled changes
- [x] T015 Outbox events and notification handlers (grace started, expired)
- [x] T016 Tests: double run, concurrent run, grace then top-up, auto-renew off, scheduled downgrade price

## Phase 4 — Fee tiers

- [x] T017 Fee-policy admin, DTOs, responses and notification handler accept tier codes; `MATERIAL_PAID_*` use the material rule shape (`feeBps` only), `ONE_WAY_*` the path shape
- [x] T018 `pinSettlementFee` uses the ONE_WAY teacher's tier; base fallback
- [x] T019 Settlement validation maps tier code to base code; rate snapshot check unchanged
- [x] T020 Material purchase uses the seller's tier; base fallback
- [x] T021 Tests: pinned tier survives expiry, TWO_WAY unaffected, missing tier policy fallback, material order snapshot

## Phase 5 — Whiteboard retention

- [x] T022 Raise the `retention_days` snapshot on each save to the highest of its value and both participants' plans
- [x] T023 Retention worker uses the snapshot; legacy rows use config; legal hold unchanged
- [x] T024 Amend spec 019 and its tests

## Phase 6 — Recording

- [x] T025 Request requires the requester's recording entitlement and remaining minutes
- [x] T026 Charge minutes once at `egress_ended`; cap at allowance; snapshot retention at start
- [x] T027 Add-on purchase endpoint
- [x] T028 Amend spec 020 D2/D6/D9 and tests: free requester, exhausted minutes, duplicate webhook, overrun, expiry after recording

## Phase 7 — Material storage (blocked by G5)

- [ ] T029 Quota check on material file attach under owner lock; usage in `GET /me/subscription`

## Verification

- [ ] T030 Real PostgreSQL concurrency tests for purchase, renewal and minutes
- [ ] T031 `pnpm --filter api lint`, `check-types`, `build` and affected suites; record results in `validation.md`
