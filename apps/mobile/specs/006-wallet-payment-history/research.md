# Research: updated Payment backend and mobile integration

**Implementation checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Test-first eligible source batch is implemented. T043/T052/T076/T078..T088/T094 complete within DOC/L/C/W/source-check criteria;100 IDs,83 checked/17 unchecked, original68 completed task bodies preserved. Normal Payment/status/create/recovery/Confirm flags remain off. Private native QA read/financial entries are source-ready, not an activated or accepted deployment. Current fields, cleanup/store/claim/create/replay/QR/status replace earlier pending-source proposals below. D1/D2/D3/D4 are not reopened. Actual API/payOS/Android/iOS acceptance and full T100 stay gated; historical results keep their original scope.

## Current Phase0 findings — 2026-10-18

Reviewed source7fc0f83 at HEAD5101aea, not deployment. [Detailed audit and exact anchors](contracts/backend-review-7fc0f83.md). Decision: D1 SOURCE_VERIFIED_WITH_LIMITATIONS; clear source-sync and retain explicit unsupported total-loss/support boundary. Rationale: creation-policy, Payment identity fallback/backfill/guards, pause/channel/unresolved-owner checks and required recovery fields are now implemented. Alternatives rejected: keep pretending source is absent, invent total-loss clearance, or treat source/BE mocked tests as financial acceptance.

Design decisions: extend existing Payment parser/types/fixtures and equal-version safety projection before create; owner status independent of US2/QR. Use existing shared client; a local ID or explicit policy GET after409 avoids assuming discarded error.details support. Same-version QR-null stays latched even when recovery metadata clears. Finalize D2 conservative cleanup/capacity before durable claim/create; no automatic unresolved TTL, no web fallback. Reuse completed D3 QR; D4 design/environment existence not re-asked.

Known limits are resolved as explicit stop conditions, not fabricated APIs: whole-identity loss, privileged restore, legacy list omission and REVIEW replacement stay support-required. Unknown operational binding/rollout/API/payOS/native results remain gates. Required recovery metadata is currently silently dropped by mobile, a concrete integration gap. New policy has no version/reservation and POST rechecks; enabled=false blocks replay even though pause with enabled=true does not. No tests/DB/API/provider calls run here. Existing evidence below is historical;100 IDs/68 completions retained.

**QR implementation checkpoint — T089..T093**: previously selected D3 tools are now installed/reviewed and tested in source/W. Exact registry integrity/license files, unchanged prior lock graph, before/after advisory comparison and bundled-core-only audit are recorded in [QR validation](contracts/qr-validation.md). Internal entry/TextEncoder/partial ECI and native scanner/maintenance limitations remain; no universal compatibility/security claim. W pixel validation found subpixel boundary antialiasing, resolved by rendering5 white modules while independently requiring4 clean modules. No D1 policy decision or real payment test was made.

## Historical completion research and clarification — 2026-10-17

Decision: D2/D3 and D4 workflow/QA entry are now approved by the user; environment reported available in the subsequent correction. D1 remains external confirmation. BE follow-up found spec005 R-07 no automatic TTL and matching helper/schema with no expiry/delete; distinguish this recorded foundation policy from deployed manual cleanup/restore/total-loss guarantees. [Decision/source audit](contracts/completion-proposal.md) records evidence and effects. No new horizon/lookup API, provider call or test claim.

Decision approved for mobile: native-first SecureStore financial record in separate namespace/module, encrypted unresolved correlation retained across logout for reauthenticated same owner; clear runtime/cache/QR, B isolation, web create unavailable. Backend uses userId+operation+key, current live authorization and owner reads, consistent with cross-session owner recovery but not credential persistence. SDK57 SecureStore/plugin exist; no auth-token-store reuse. Storage/network atomicity and total-loss limitations remain, final cleanup/replay depends D1. Alternatives/limitations remain in the decision packet.

Decision approved for QR: qrcode1.5.4/existing SVG plus independent dev-only jsqr1.4.0/pngjs7.0.0 and typings when needed. Backend supplies raw1..4096-character string only while server projection permits QR; it does not guarantee capacity, encoding/ECI or banking scan compatibility. Keep raw bytes/null/version authority and fail capacity without replacing Payment. Dependency/security/import/TextEncoder/pixel/native checks remain future gates. Alternatives previously researched remain historical; do not reselect without new evidence.

Two skill-directed read-only research audits checked backend guarantees and primary QR sources; neither edited files, installed packages, accessed credentials or called a payment/provider. SRS V1.6 was re-read for backend-only verified crediting/idempotent callback/no cash-out. Current backend comparison against081b3d2 shows no Payment/idempotency/schema drift; no application tests were rerun by this planning invocation.

**Review date**: 2026-10-17. Original baseline17e3ac1; Payment081b3d2 merged byf80ef7a; inspected checkout4121c3f. Source was read, not modified or called. SRS V1.6 remains product authority. Backend spec009 is compared with source; stale “unimplemented” headings and design-only admin contracts do not override implemented controllers.

## Evidence classification

- **Implemented source**: wired controllers/use cases/DTOs/persistence inspected below. Deployment/merchant acceptance is separate.
- **SRS / accepted policy**: exact units, no cash-out, backend verification and top-up policy; source confirms selected policy.
- **Fixture / reported test evidence**: existing mobile P1..P5 and I1/I2 models/loopback/web plus backend mocked-provider tests. Neither is real payOS acceptance.
- **Approved design / unresolved execution gate**: D2 storage/native-first, D3 encoder/decoder scope and D4 two-device QA workflow are selected; implementation/security/QR checks and actual environment binding/evidence remain future work. D1 operational exceptions/total-loss is unresolved. Owner-read schema/adapters/status have L/C/W evidence; no proposed endpoint/body is presented as implemented.

Two read-only research audits were dispatched per speckit-plan: Payment HTTP/wiring and idempotency/recovery/freshness/posting. Findings are consolidated here; no agent changed files or contacted a provider.

## Source evidence catalog

E IDs retained for existing task references. Paths are repository-relative. **P**=`services/api/src/modules/payments/`, **C**=`services/api/src/modules/credit/`, **M**=`apps/mobile/src/`.

| ID  | Source                                                                                                                                                                                                    | Current finding                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | `services/api/src/app.module.ts:37,87`; P`payments.module.ts:21–43`; C`presentation/http/wallet.controller.ts:26–67`                                                                                      | Payments and owner Wallet/history controllers are wired; previous “pure adapter only” inventory superseded                                    |
| E02 | C`application/use-cases/get-wallet.use-case.ts:17–26`; `presentation/http/wallet.responses.ts:13–17`; `infrastructure/persistence/prisma-wallet.repository.ts:28–44`                                      | Exact Available/Held and walletVersion; authorized missing wallet virtual zero with no grant                                                  |
| E03 | C`presentation/http/wallet.responses.ts:19–35`; `application/services/ledger-entry.mapper.ts:4–19`; repository:47–85                                                                                      | Recorded magnitude, signed deltas, post-balances, reference/reversal; owner predicate; no implied destination access                          |
| E04 | P`presentation/http/payments.controller.ts:46–144`; `payments.dto.ts:16–69`; `application/use-cases/read-payments.use-case.ts:14–108`                                                                     | Actual create/list/detail/webhook; seven states incl REVIEW, numeric version and nullable checkout, flat wire projection                      |
| E05 | C`domain/money.ts:6–47`; P`domain/top-up-policy.ts:5–27`; `application/use-cases/create-payment.use-case.ts:28–85`                                                                                        | Exact units and settled bounds/rate/TTL; persisted quote is returned via Payment, no public quoteId/policyVersion endpoint                    |
| E06 | `services/api/src/infrastructure/idempotency/idempotency.service.ts:80–134`; create use case:35–85; `services/api/prisma/runtime-support.prisma:114–125`                                                  | Owner/operation/key/body resource replay durable; current detail on replay; retention not guaranteed and no GET-by-key                        |
| E07 | `services/api/src/shared/http/response.ts:3–18,45–73`; P read use case:49–61; C`application/services/credit-provenance.service.ts:8–44`                                                                   | Standard envelopes, nonowner detail404 and provenance eligibility409; generic errors are not proof of no creation                             |
| E08 | M`features/wallet/{schemas,api,hooks,utils,views,preview}`; tests/wallet-*.test.ts                                                                                                                        | P1..P3 actual owner reads; P4/P5 injected preparation, not Payment wire adapter                                                               |
| E09 | M`features/wallet/components/home-wallet-balance.tsx`; `hooks/use-wallet.ts`; `context/WalletProvider.tsx`                                                                                                | Home and Wallet share owner projection; no new/returning-account sample money                                                                 |
| E10 | M`lib/http/client.ts:6–16,90–130`; `providers/QueryProvider.tsx:7–16`                                                                                                                                     | Shared signal/key/auth transport; create requires replayAfterRenewal:false independently of query retry                                       |
| E11 | M`features/auth/context/AuthSession.tsx`; `context/session-controller.ts`; `features/wallet/context/wallet-runtime.ts`                                                                                    | Session generation and financial cache cleanup; old responses cannot cross owner                                                              |
| E12 | M`features/wallet/utils/payment-observer.ts`, `payment-outcome.ts`, `payment-refresh.ts`                                                                                                                  | Coalescing/tickets/denial and independent refresh reusable; current six-state expected-quote/conflict-only local model needs adaptation       |
| E13 | M`providers/use-app-connection.ts:26–66`; `providers/ConnectionGate.tsx:11–26`; `lib/http/response.ts:35–64`                                                                                              | Reuse connection read recovery; page parsermax50 vs BEmax100 remains compatible with explicit20                                               |
| E14 | M`features/wallet/{index.ts,screens.tsx,views,components,preview}`; M`app/wallet`                                                                                                                         | Thin existing routes/public boundary/isolated preview retained; no real Payment activation                                                    |
| E15 | `apps/mobile/tests/wallet-payment-{intent,transport,status,observer,refresh,recovery}.test.ts`; `tests/wallet-qr.test.ts`                                                                                 | Existing model/preparation assertions are not real DTO/provider/device tests                                                                  |
| E16 | `apps/mobile/package.json`; `services/api/specs/009-credit-payment/contracts/gateway.md`; P read use case:15–39                                                                                           | QR-only payload available; SVG exists, no encoder selected. No hosted checkout or mobile return/cancel requirement                            |
| E17 | C`domain/ledger-cursor.ts:18–67`; C`application/use-cases/list-credit-transactions.use-case.ts:19–60`; P`application/use-cases/read-payments.use-case.ts:62–108`; P`payments.module.ts:37–42`             | Separate signed ledger and Payment cursors: ledger sequence/type/referenceType vs orderCode/status; Payment status membership remains mutable |
| E18 | `services/api/prisma/migrations/20261017000000_payos_payments/migration.sql:3–7`; C`application/services/credit-operations.service.ts:10–109`; `services/api/specs/009-credit-payment/validation.md:1–40` | Empty-only legacy auto-tracking; provenance guard and permanent TOP_UP identity; backend test report uses mocked provider                     |
| E19 | P`application/services/payment-receipts.service.ts:62–172,233–289`; `payment-checkout.worker.ts:25–293`; `infrastructure/payos-transport.ts:28–105`; `services/api/docs/payos-qr-payments.vi.md:144–163`  | Signed atomic posting and durable checkout recovery implemented; fixed-origin bounded transport; merchant/deployment gates remain             |

## Comparison with spec009-credit-payment

Actual controller/DTO/use cases now fulfill the previously proposed Payment create/list/detail/webhook tranche. Backend spec009 validation's newest section records this; some spec/task introductions still describe the earlier baseline. The source and newest validation block are used for implementation inventory; no backend doc is changed.

Design-only public quote/policy/admin/refund/reconcile/lookup-by-key is not promoted to an API. Server SSE is implemented evidence/hint infrastructure but not a new selected mobile dependency or schedule. Backend worker restart tests are not device process-restart tests.

Wallet controller/DTO/response/repository/ledger-cursor contract files have no change in the17e3ac1..4121c3f comparison; P2/P3 need no wire migration. New backend provenance checks affect create eligibility, not permission to rewrite historical ledger or mobile balances.

## Decisions, rationale and alternatives

### R-01 — Separate source availability from activation

**Decision**: Mark GAP-03/05 source available, GAP-06 partial, QR-01 blocked; permit planning owner status independently.
**Rationale**: E01/E04/E06/E19 establish real APIs and posting, not mobile/runtime readiness.
**Alternatives considered**: Retain blanket “API missing” (incorrect); declare all payment ready after merge (ignores recovery/QR/environment).

### R-02 — Preserve owner session and exact units

**Decision**: Reuse WalletProvider/shared HTTP/auth/query/connection; bind owner locally, forward signal, validate decimal text, evict denied data.
**Rationale**: E02/E03/E09..E13; DTO supplies no owner and cancellation alone cannot prevent late results.
**Alternatives considered**: New HTTP stack, response owner fabrication, float amounts or cache fixture fallback (break current boundaries).

### R-03 — Estimate before create, confirmed quote after create

**Decision**: Review settled policy locally as an estimate; parse confirmed Payment fields on successful create/replay, preserving that ID on mismatch/error.
**Rationale**: E05 implements persisted quote inside create, not a standalone quote endpoint; no public policyVersion/quoteId.
**Alternatives considered**: Fake quote request/DTO or reset expiry from mobile time (unsupported); silently recreate on changed quote (unsafe).

### R-04 — Version-aware owner observation with QR exception

**Decision**: Accept newer same-payment version, ignore lower, stale conflicting equal status/quote; allow equal-version checkout:null to suppress QR without restoring from stale QR. Do not rank status.
**Rationale**: E04 read-time server expiry can hide QR without version increment; E19 permits delayed valid EXPIRED→PAID and REVIEW.
**Alternatives considered**: Whole-projection equality at equal version (rejects valid suppression); P5 keep-every-change-stale forever (blocks live progress); monotone enum rank (false transition policy).

### R-05 — Explicit immutable create and bounded recovery

**Decision**: Preserve synchronous claim, freeze real key/body before dispatch, disable mutation retries and replayAfterRenewal; explicit same-intent replay only under approved recovery/retention policy. New real create remains off until GAP-06 decisions.
**Rationale**: E06 stores resource reference, E10 HTTP may otherwise resend; provider-disabled check precedes idempotency lookup. No record TTL guarantee/GET-by-key.
**Alternatives considered**: New key after timeout, auto replay on resume or matching amount/time (cannot prove intent identity); memory-only “restart recovery” (false).

### R-06 — Manual reads and separate dependent refresh

**Decision**: Known-ID owner GET must bootstrap from ID/session without US2 expected amount; PAID then refresh Wallet/History independently. No selected polling/SSE cadence.
**Rationale**: E04/E12 actual GET carries confirmed quote/version; no mobile polling contract is needed for manual checks.
**Alternatives considered**: Require intent before status (breaks US3); revert PAID on wallet read error or local Credit arithmetic (wrong authority).

### R-07 — Preserve separate pagination domains

**Decision**: Both lists send20, but Payment orderCode/status cursor stays separate from ledger sequence/type/referenceType. Owner discovery requires explicit selection, not automated recovery matching.
**Rationale**: E13/E17; Payment watermark freezes order boundary, not mutable status.
**Alternatives considered**: Reuse ledger filters/cursor or widen shared parser (unnecessary/incompatible); call status-filter pages a full immutable snapshot (false).

### R-08 — Gate QR, provenance and environment evidence explicitly

**Decision**: No package selection/financial call now; keep QR-01, eligible-wallet migration and merchant/native evidence gates.
**Rationale**: E16/E18/E19; source tests and QR text do not prove scan/payment/device behavior.
**Alternatives considered**: Remote QR image, homemade encoder, client provenance repair or mocked-provider PASS as merchant proof (unsupported).

## Phase 0 disposition

Research resolves what current source implements and where the mobile design must change. Outstanding retention/correlation security, QR review and deployment/channel/native decisions are explicitly deferred activation gates, not missing payload facts to be guessed. No policy, provider endpoint or key retention promise is invented. [Plan](plan.md) sequences independently verifiable follow-on work without executing it.
