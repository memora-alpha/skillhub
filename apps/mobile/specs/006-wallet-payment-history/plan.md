# Implementation Plan: Wallet, payment status and transaction history

**P5 preparation checkpoint — 2026-10-17**: T044..T051 implement independent US3 observation/refresh models, an unavailable normal status view and labeled synthetic preview. Reader/related reads are injected; default unavailable, no Payment API/schema/hook or intent dependency. Owner/scope/identity/exact-money association is validated locally. Conflicting observations retain the previous snapshot stale without invented server ordering; denial evicts it. PAID and each related refresh result stay separate. Recovery tests record known/lost-ID/reauth/process-loss gates without storage/lookup/create. Validation records22 independent US3,86 focused/382 regression tests and8 W groups. T042/T043/T052..T062 stay unchecked; no T053/T055 work, real financial activation, QR decoder or native acceptance. Earlier phase checkpoints below are historical.

**P5 preparation checkpoint — 2026-10-17**: T044..T051 implement independent US3 observation/refresh models, an unavailable normal status view and labeled synthetic preview. Reader/related reads are injected; default unavailable, no Payment API/schema/hook or intent dependency. Owner/scope/identity/exact-money association is validated locally. Conflicting observations retain the previous snapshot stale without invented server ordering; denial evicts it. PAID and each related refresh result stay separate. Recovery tests record known/lost-ID/reauth/process-loss gates without storage/lookup/create. Validation records22 independent US3,86 focused/382 regression tests and8 W groups. T042/T043/T052..T062 stay unchecked; no T053/T055 work, real financial activation, QR decoder or native acceptance. Earlier phase checkpoints below are historical.

**P4 preparation checkpoint — 2026-10-17**: T033..T041 are implemented as local policy/review/intent, session ownership, an inert injected dispatch seam and synthetic QR shell/specification. Normal Confirm and quote/create/status/recovery capabilities remain disabled; no Payment adapter/schema, key allocation, encoder, durable journal or P5 observer was added. Owner-read implementations remain unchanged. T038 completes test preparation only: renderer/independent decode is explicitly BLOCKED in [qr-validation.md](contracts/qr-validation.md), with T042 unchecked. Source remains17e3ac1 without backend drift. [Validation](validation.md) records63 focused/359 regression tests and7 synthetic web observations; no financial/API/channel/native acceptance is inferred. The phase design below remains the future change map where not explicitly superseded.

**Branch**: `feat/mobile-wallet-payment-history` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: `apps/mobile/specs/006-wallet-payment-history/spec.md` and the user's detailed planning instructions.

**Status**: Replanned at backend merge `17e3ac1` on 2026-10-16. GAP-01/02 have implemented read contracts and GAP-04 has an approved pure policy; P2/P3 can be implemented after the shared mobile foundation. Payment orchestration/query/posting/recovery remain blocked. No mobile or live financial acceptance is claimed.

**Implementation checkpoint2026-10-17**: P1 then P2 T001..T020 are now implemented; [validation.md](validation.md) records32 focused and328 regression tests plus scoped synthetic web observations. Wallet GET is integrated through shared current-owner Home/overview query; other financial capabilities remain off. Backend/source contract is unchanged. The planning-only wording and proposed file map below are the original design snapshot, not the current implementation inventory; actual files/ownership are in validation. T021+ and T053+ checkpoints are not implemented/accepted by P2. A/G/NA/NI remain NOT_RUN.

**P3 checkpoint2026-10-17 (current)**: T021..T032 are also implemented, with48 focused/344 full regression tests and10 synthetic web observations. All three source-backed reads now have focused owner/session integration; History/detail adds page20/filter/snapshot/denial/reference behavior independently of Payment. T033..T062 and all T053+ checkpoints remain unchecked. Backend/source contract still17e3ac1; shared max50/dependencies unchanged. Earlier checkpoint paragraphs and the original change map are historical; current files/limits are in validation. A/G/NA/NI and operational Payment/QR-01 remain pending/blocked.

## Summary

Replace the authenticated wallet's sample account data with owner-scoped reads, exact amount presentation, read-only ledger browsing and backend-authoritative payment status. Keep the six existing wallet routes, existing Profile/Home navigation, current authentication transport and the app connection boundary. Home consumes the same wallet balance projection rather than `isNew` samples.

Build a session-scoped wallet runtime with independent capabilities. Wallet/history adapters now bind to the three actual owner reads in [wallet-http.md](contracts/wallet-http.md); payment adapters still wait for operational contracts. Keep explicit immutable creation intent, synchronous runtime lock and unknown-outcome retention. Replace hosted handoff with payOS QR encoded/rendered locally inside SkillHub. QR data/providerStatus, legacy redirects, timers and screen closure never post Credit, cancel payment or decide its financial outcome.

This command produces design documents only. No mobile/backend source, shared packages, dependencies, application configuration or financial records are changed. No `tasks.md` or implementation phase is started.

## Technical Context

**Language/Version**: TypeScript `~6.0.3`, React `19.2.3`, React Native `0.86.3`, Expo `~57.0.26`; versions are taken from [package.json](../../package.json), not proposed upgrades.

**Primary Dependencies**: Existing Expo Router, TanStack Query, shared Axios HTTP, React Hook Form/Zod, theme/components, session controller and react-native-svg. Preserve shared transport. A vetted local QR encoder still needs version/license/native-web evaluation and independent decode tests at QR-01; SVG alone is not an encoder. No package is selected/installed by planning. No hosted browser/WebView/deep-link payment launcher is required.

**Storage**: Server owns wallet/payment/ledger. Mobile holds private query cache and current-session draft/intent state only. No persisted balances or offline payment queue. Durable payment correlation/recovery is an external contract decision under GAP-06; current memory state is not restart recovery.

**Testing**: Existing `node:test`/strict assertions through `tsx`, controlled transport/deferred-response tests, a planned tracked fixture harness, web visual checks, then separately authorized real owner-API/approved payOS-channel and Android/iOS acceptance. Detailed cases: [validation-matrix.md](validation-matrix.md).

**Target Platform**: Existing Android/iOS application and web preview. This Windows checkout cannot establish local iOS-device behavior. No remote simulator or paid service is required for this documentation phase.

**Project Type**: Existing mobile workspace in the monorepo; no new service, package, database or nested Git repository.

**Performance Goals**: Preserve SC-001..007: exact balances, preparation within 60 seconds excluding external waits, zero false success/unintended duplicate intents, stable history of at least 200 records, private session isolation and readable 320-logical-pixel layouts. Use a virtualized history list; do not invent a server throughput/latency SLA.

**Constraints**: Backend-only verification; no cash-out/peer transfer/admin actions, optimistic crediting, fixture fallback or automatic creation replay. Approved policy: payOS QR-only, 1,000–2,000,000 VND in 1,000 steps, immutable server quote TTL60 minutes. This does not provide a live quote/status API or permit client expiry. Manual checks are baseline once owner query exists; no invented polling interval, SSE consumer or retry schedule.

**Scale/Scope**: Four journeys, six existing routes, one shared Home balance surface, 25 requirements, seven success criteria and eight tracked gap IDs with mixed source/policy/runtime dispositions. Optional reference/refund context is gated separately from aggregate balances.

**Evidence**: Current commit `17e3ac1f38df1b645bd5f103a7111eae00f5e0b4`. [research.md](research.md) records source and backend-reported validation separately. WalletController is implemented/wired; payOS adapter is pure protocol code and not a working payment API. Original staged blobs are preserved; replan edits are unstaged Markdown only.

## Constitution Check

Gate results before research and after design are distinct from implementation acceptance.

| Principle                                                          | Before Phase 0 | After Phase 1 | Design evidence                                                                                        |
| ------------------------------------------------------------------ | -------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| Mobile scope; backend needs separate authorization                 | PASS           | PASS          | Only this feature's Markdown artifacts change; backend is read-only evidence.                          |
| Preserve Expo app, thin routes, public feature boundaries          | PASS           | PASS          | Existing routes retained; proposed feature layout below; Home uses Wallet's public export.             |
| Shared transport/session/query, private cache, no fixture fallback | PASS           | PASS          | Session runtime, abort + epoch guards, owner denial eviction and explicit preview mode.                |
| Theme/accessibility/navigation/native evidence                     | PASS           | PASS          | Existing shell/forms reused; UI contract includes text states and Back; evidence layers stay separate. |
| Backend financial authority and privacy                            | PASS           | PASS          | No financial posting; payment/ledger states separated; unknown creation blocks resubmission.           |
| Appropriate checks and honest evidence                             | PASS           | PASS          | Documentation checks now; implementation checks and sandbox/native acceptance remain planned.          |
| Preserve completed artifacts and existing branch                   | PASS           | PASS          | Spec requirements retained, checkpoint corrected narrowly, no source/branch changes.                   |

No constitutional exception is needed. [Integration gates](contracts/integration-gates.md) distinguish source-ready reads, settled provider/policy and still-blocked operational payment. Before/after-design checks pass for documentation scope, shared boundaries and financial authority. Deployed migration readiness and application acceptance are not waived. This command preserves the existing index and branch and does not create tasks.

## Project Structure

### Documentation (this feature)

```text
specs/006-wallet-payment-history/
  spec.md                         existing behavior and acceptance requirements
  contracts.md                    existing source/contract checkpoint, corrected narrowly
  plan.md                         technical context, file scope, stages and readiness
  research.md                     source evidence and decision/rationale/alternatives
  data-model.md                   proposed local models, exact values and state ownership
  contracts/
    integration-gates.md          GAP-01..08 evidence and contract entry gates
    wallet-http.md                actual owner-read DTO/page/filter and compatibility contract
    ui-flows.md                   per-step UI behavior, errors, Back and preview boundaries
    payment-recovery.md           intent lifecycle, races, recovery and session cleanup
  validation-matrix.md            cases and US/FR/SC traceability
  quickstart.md                   reproducible validation guide and prerequisites
  checklists/
    requirements.md               existing specification-quality checklist
    planning.md                   design completeness review; not implementation acceptance
```

`tasks.md` is intentionally absent; it is the output of a later explicitly invoked command.

### Source Code (repository root)

The following is a **proposed change map**, not files created by planning. Create only the parts needed by an entered stage and keep hooks/adapters/utilities near 180 lines, views/components near 220, and routes near 80 as documented.

| Planned paths under `apps/mobile/`                                                                                                   | Responsibility and stage                                                                                                                                    | Current status                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/features/wallet/index.ts`                                                                                                       | Preserve six screen exports; expose only provider and a small Home balance consumer. Avoid exporting mutable intent internals. P1/P2.                       | Existing, modify later.                                                                              |
| `src/features/wallet/context/WalletProvider.tsx`                                                                                     | Runtime keyed by owner/generation; scoped queries, synchronous intent lock, cleanup and injected test capabilities. P1.                                     | Proposed new.                                                                                        |
| `src/features/wallet/types/{wallet,payment,transaction}.ts`                                                                          | Local UI state plus actual wallet/ledger projections; future payment DTOs stay unconfirmed. P1.                                                             | Proposed new.                                                                                        |
| `src/features/wallet/utils/{amount,wallet-query-keys,read-access,history-query}.ts`                                                  | Exact decimal text, scoped keys, denial eviction, cursor/filter identity. P1/P2/P3.                                                                         | Proposed new.                                                                                        |
| `src/features/wallet/utils/{payment-intent,payment-outcome}.ts`                                                                      | Explicit intent identity, immutable submission snapshot, ambiguity and backend outcome projection. P1/P4/P5.                                                | Proposed new.                                                                                        |
| `src/features/wallet/api/{wallet-api,payment-api,transaction-api}.ts`                                                                | Confirmed owner HTTP endpoints only; shared client, strict projection, AbortSignal, explicit replay choice. P2–P5.                                          | Do not fill with guessed endpoint strings.                                                           |
| `src/features/wallet/schemas/{wallet,payment,transaction}-contracts.ts`                                                              | Wallet/ledger schemas now use actual DTOs; payment schema remains gated.                                                                                    | Wallet/ledger source-ready; payment blocked.                                                         |
| `src/features/wallet/hooks/{use-wallet,use-transactions,use-transaction}.ts`                                                         | Authoritative reads, lifecycle refresh, scoped pagination, denial/refresh behavior. P2/P3.                                                                  | Proposed new.                                                                                        |
| `src/features/wallet/hooks/{use-create-payment,use-payment-status,use-wallet-back}.ts`                                               | Thin runtime/UI orchestration, manual checks, focus cleanup and contextual Back. P1/P4/P5.                                                                  | Proposed new.                                                                                        |
| `src/features/wallet/views/{wallet,topup,payment,payment-status,transactions,transaction-detail}-screen.tsx`                         | Replace the corresponding real-account screen composition; one responsibility per file. P1–P5.                                                              | Split existing `screens.tsx` rather than extend its monolith.                                        |
| `src/features/wallet/components/{wallet-balances,home-wallet-balance,payment-status-panel,transaction-row,financial-read-state}.tsx` | Small displays; text distinguishes stale/unavailable/verified states. P1–P5.                                                                                | Proposed new as actually needed.                                                                     |
| `src/features/wallet/preview/`                                                                                                       | Move/reuse the existing labeled fixture screens/data in an isolated preview host. P1.                                                                       | Existing samples currently in `screens.tsx`/`fixtures.ts`; do not silently delete accepted previews. |
| `src/app/wallet/{index,topup,payment,payment-status,history}.tsx`, `transactions/[id].tsx`                                           | Keep six routes; parse navigation identity only; never trust `state` or `amount` as a confirmed payment outcome/quote.                                      | Existing, focused wiring changes later.                                                              |
| `src/providers/AppProviders.tsx`                                                                                                     | Mount WalletProvider under authenticated session lifetime so Home/wallet share one runtime. P1.                                                             | Existing, focused addition.                                                                          |
| `src/features/home/components/HomeContent.tsx`, `screens/HomeScreen.tsx`                                                             | Replace only the account balance surface using the Wallet public consumer; leave unrelated mock learning content. P2, safe unavailable display in P1.       | Existing.                                                                                            |
| `src/features/profile/components/ProfileLayout.tsx`, `components/ProfileShortcuts.tsx`, `src/constants/navigation.ts`                | Existing shortcut already opens `/wallet`; verify, preserve mapping and contextual Back. Remove stale wallet notice only if affected.                       | Primarily regression checks; no new route needed.                                                    |
| `src/features/ui-preview/screens.tsx`, `src/features/product-shell/context.tsx`                                                      | Retarget sample wallet outcomes/references to an explicit preview host; no notification API integration. P1.                                                | Existing, narrowly change preview destinations if required.                                          |
| `src/app/ui/wallet-preview.tsx`                                                                                                      | Proposed preview-only wrapper reachable from gallery, not an alternate real payment route. Validate its exact route against Router source when entering P1. | New only if needed to retain previews without fake real IDs.                                         |
| `src/features/auth/components/AuthNavigator.tsx`                                                                                     | Preserve protection for the six real routes; register a new preview wrapper inside the intended authenticated group if it is added. P1.                     | Existing, focused route registration only if needed.                                                 |
| `tests/wallet-{money,runtime,contract,payment-intent,payment-status,history,navigation}.test.ts`                                     | Client state, actual wallet/ledger contracts, QR encoding/decoding and gated payment races. P1–P5.                                                          | Proposed tests, not generated now.                                                                   |
| `tests/fixtures/{wallet-model,wallet-api}.ts`, `scripts/wallet-browser-validation.mjs`                                               | Labeled model fixtures now; loopback API fixture only after real contract agreement; tracked reproducible browser harness.                                  | Wallet/ledger fixture can bind actual contract now; Payment fixtures remain local model/design only. |

**Structure Decision**: Keep all implementation in `apps/mobile`. No changes to shared packages, root tooling or `services/api` are justified. Use the existing shell with a feature-owned `FlatList` for unbounded history; do not nest it inside `FeaturePage`'s scroll view. Existing form fields/Button/FormNotice can be composed with an asynchronous submit owner; `DataForm` alone does not own async pending state. Consult installed `@expo/ui` for any new native picker/menu/sheet; preserve existing theme/components and avoid a new UI library.

## Phase 0 — Research outcome

Completed in this replan: source/spec009 delta review and two research audits, exact owner-read contract, compatibility decisions and revised GAP-01..08 dispositions. Provider, amount/step and TTL are now evidenced rather than open questions. Payment API/posting/recovery and runtime acceptance are still not claimed; see [research.md](research.md).

## Phase 1 — Design outcome

Completed in this command: local data model, UI/recovery contracts, integration gate ledger, verification matrix and validation guide. The post-design Constitution Check passes for this bounded design. Implementation stages below are **future work**, not completed tasks.

## Implementation stages and stop conditions

### P1 — Session foundation and truthful unavailable/preview surfaces

- **Goal/files**: Wallet provider, local types/amount utilities, read-state components, six small views, Home unavailable balance, public exports, provider wiring and isolated preview entry/destinations.
- **Entry**: This design reviewed; existing spec scope retained. No wallet HTTP capability is required to model client state.
- **Work**: Scope runtime/cache by owner+generation; abort forwarded reads, remove scoped queries, clear drafts/intent observers on session disposal; create no real HTTP adapter yet. Preserve sample flows in explicit preview mode with zero live mutation egress. Keep current Profile/Home route mappings.
- **Exit**: Unit/state/race cases V01..V06, V14..V18, V24..V26 pass for implemented foundation; no fake real balances/status; loopback/model preview provenance clear; focused lint/type/structure checks pass.
- **Stop**: No invented payment endpoint/policy, preview-as-live, root/backend scope expansion or durable-recovery promise. P1 does not block source-backed read integration behind unrelated payment gaps.

### P2 — Authoritative wallet and shared Home balance

- **Goal/files**: Wallet API/schema, `use-wallet`, balance displays, Home public consumer; no duplicate Home request/cache.
- **Entry**: GAP-01 source contract is available; shared session foundation ready. Confirm deployed migration/configuration for real environment tests, not by assuming merge equals deployment.
- **Work**: GET `/me/wallet` using shared authenticated client; validate exact decimal strings and walletVersion, no invented owner/as-of field. Successful absent-row response is virtual zero; errors are not. Forward signals and keep same-session/request guards; share one Home balance projection.
- **Exit**: V01..V06/V24 and real-read V27 recorded separately. Home/wallet match; virtual zero is authoritative only from successful read.
- **Stop**: Source/DTO drift, migration failure, denied access or invalid projection blocks affected acceptance, not all implementation. Payment gaps do not block this read.

### P3 — Owner transaction history and details

- **Goal/files**: Transaction API/schema, list/detail hooks/views, row/context display and scoped filter/pagination utilities.
- **Entry**: GAP-02 source contract available; basic reversal/reference fields from GAP-07/08 available for display, arbitrary related navigation still gated.
- **Work**: GET actual list/detail with explicit limit20, shared requestPage and wallet-owned row schemas. Use type/referenceType only, no status query. Preserve descending sequence order, opaque owner/filter-bound snapshot cursors, and no public sequence requirement. Cursor-free refresh/filter change rebuilds the chain; never attach old continuation pages to a new watermark. Preserve prior pages on errors; evict denied details; do not calculate balances from entries.
- **Exit**: V19..V23 plus V01/V02/V24/V27 pass; 200-entry dataset exercises multiple pages, ties and filter races. Optional context omitted honestly if still gated.
- **Stop**: No status/date/search parameter, cursor decoding/building/TTL, requesting limit51–100 through the existing max50 parser or shared-parser widening. Invalid cursor400 permits explicit fresh-chain recovery, never automatic financial action. Contract/deployment drift remains an acceptance gate.

### P4 — Top-up preparation, explicit creation and in-app payOS QR

- **Goal/files**: Approved-policy amount/review, intent coordinator and future payment adapter, plus proposed `components/payment-qr.tsx` and local encoder boundary in `utils/qr-payload.ts`.
- **Entry**: Local policy/QR UI models can be prepared now. Real creation requires operational GAP-03/05/06 contracts, persisted quote projection, QR-01 renderer verification and merchant/atomic-posting evidence. P5 known-payment reads may precede creation once that API exists.
- **Work**: payOS fixed provider; approved range/step/rate; backend quote final. Keep runtime single-flight and immutable intent, no renewal replay/unknown-outcome shortcut. Encode exact raw qrCode locally, not Image/SvgXml/HTML/URL, remote service or hosted browser. Separate preparing/null checkout, rendered QR and render error from Payment status; providerStatus is not owner PAID. Retain known ID through render failure/closing/foreground.
- **Exit**: V07..V13/V25 plus independent QR decode, long payload/quiet-zone/320px/accessibility and no-egress evidence. V28 provider/backend proof before real enablement. Same-device scan usability is explicitly validated; save/share/deep-link/scanner actions are not silently added.
- **Stop**: No public payment API/recovery, unsafe/unverified QR renderer, missing channel proof or unknown creation keeps real Confirm off. No TTL reset, local cancellation, credential exposure, new payment from renderer retry or shared HTTP behavior change.

### P5 — Payment observations and recovery

- **Goal/files**: Future owner status adapter/hook/view, known-payment identity from the in-app QR workflow and independent wallet/history refresh coordination. No return/cancel route.
- **Entry**: GAP-05 and the applicable GAP-06 recovery rules confirmed; known-owner payment identifiers may be used independently of creation UI.
- **Work**: Future authenticated owner Payment read only, separate from adapter providerStatus. Manual checks, per-ID/session/request guards and denial eviction; PAID stays separate from failed wallet/history refresh. Leaving/resuming QR only rechecks a known ID once the API exists. No assumed SSE consumer or scheduled polling; a future approved checking budget/quote expiry cannot decide financial expiry locally.
- **Exit**: V14..V18, V24/V25 and the status subset of V27/V28 pass. No local crediting, fabricated ledger entry or inferred refund payout occurs.
- **Stop**: No identity correlation, server freshness/transition expectation or restart recovery contract means that recovery path remains unavailable. A local navigation/session mechanism cannot be advertised as durable recovery.

### P6 — Real read integration, payOS channel and platform acceptance

- **Goal/files**: Execute [quickstart.md](quickstart.md), attach evidence to a future `validation.md`, reconcile results with the traceability matrix; update docs only with observed results.
- **Entry**: Relevant capability gates closed, implementation checks pass, isolated tests prove no unintended egress; separate permission/environment available for real API/gateway testing. No production-money tests are implied by this plan.
- **Work**: Real A/B owner reads and migration readiness; independently decoded exact QR on web/native; separately authorized provider/channel verification and backend callback/posting/recovery proof; Android/iOS QR/resume/Back/accessibility and supported scan usability. Do not invent a payOS sandbox host or make a real transfer merely because no sandbox is available.
- **Exit**: All applicable V01..V30 and SC-001..007 have evidence at their required layer; unresolved native/channel dependencies remain explicit, not checked off from web fixtures.
- **Stop**: Missing environment, callback/atomicity proof, native device, source/config drift or failed financial invariant prevents the affected acceptance claim. Preserve successful independent evidence and report the exact remaining gate.

P2 and P3 are independent reads after P1. P5 can validate known payment reads before P4 enables creation. P4's real-money continuation cannot bypass P5/backend verification gates. No stage requires implementing backend adapters in this feature.

## Decisions and remaining activation evidence

| Decision                               | Revised status                              | Remaining evidence / consequence                                                                                                           |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| D01 wallet DTO/units/virtual zero      | Source-confirmed GAP-01                     | P2 ready; environment migration, owner/session and mobile read acceptance pending.                                                         |
| D02 ledger projection/snapshot/filters | Source-confirmed GAP-02                     | P3 uses limit20, type/referenceType and opaque sequence snapshot; no status filter. Mobile/deployed tests pending.                         |
| D03 provider and QR workflow           | payOS QR-only selected; pure adapter exists | Public create/readiness/QR API, QR-01 local encoder/independent decoding and supported scan usability pending. No hosted handoff.          |
| D04 amount/rate/TTL                    | Approved and pure helper implemented        | 1,000–2,000,000 VND, step1,000, rate1,000, server quote60 minutes; public persisted quote/expiry and operational acceptance pending.       |
| D05 owner Payment observations/posting | Operationally blocked                       | Actual owner query, verified receipt/posting/freshness/expiry and backend/channel proof required; QR providerStatus is not Payment status. |
| D06 payment idempotency/recovery       | Operationally blocked                       | Lost-ID/same-intent/restart contract and evidence; no auto new intent or replay shortcut.                                                  |
| D07 reversal/refund context            | Basic ledger fields available               | Read supplied reversal/deltas; no inferred partial/cash payout or execution.                                                               |
| D08 reference/held detail              | Safe reference fields available             | Arbitrary related destination/held allocation remains gated independently of primary reads.                                                |

**QR-01** is a consumer dependency/verification gate within GAP-03, not a new financial API or a reopened provider decision. react-native-svg is installed; no QR encoder is currently installed. Choose/validate a vetted local encoder and independently decode rendered output before payment UI acceptance. Do not silently add camera/scanner, QR save/share, bank-app deep link or same-device payment promises.

## Material risks and mitigations

| Risk                                              | Concrete trigger                                                                     | Planned protection / proof                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Duplicate payment despite disabled mutation retry | Shared HTTP renews token and replays POST after 401                                  | Explicit replay opt-out + V10; safe replay only after payment-specific agreement.                          |
| Duplicate after lost response/remount/app restart | Server created payment but client has no ID                                          | Runtime intent lock/unknown state; backend reconciliation gate; V08/V09/V13/V25.                           |
| False success or wrong-account disclosure         | QR providerStatus/forged legacy `state`, other owner ID or late old-session response | Owner Payment reads only, never QR/providerStatus; epoch/sequence guards and denial eviction; V01/V14/V15. |
| Wrong money/direction                             | Number precision, implicit `/100`, hold/fee amount treated as Available delta        | Exact canonical text and contract-bound projection; V03/V21.                                               |
| False top-up failure                              | Payment PAID but wallet/history refresh errors                                       | Separate confirmed outcome and read refresh state; V16.                                                    |
| Incorrect history                                 | Equal timestamps, new rows, stale cursor/filter/page race                            | Contract stable order/consistency, scoped keys, dedupe, explicit cursor recovery; V19/V20/V23.             |
| Demo contaminates real account                    | Old sample URL or gallery notification enters real view                              | Preview host isolation, no fallback, prohibited live mutation egress; V26.                                 |
| Overclaimed acceptance                            | Web fixture passes but provider/native untested                                      | Separate V27/V28/V29 evidence and SC-007 gate.                                                             |

QR rendering is an additional bounded risk: malformed/dense payload, remote-image interpretation or renderer retry must not leak raw QR, yield an incorrect decodable amount or create another payment. QR-01 and V12/V29 cover exact independent decoding, no-egress and usable scan presentation.

## Complexity Tracking

No constitutional violation is justified. Shared wallet runtime covers Home/read consistency and cross-screen intent lifecycle. Actual wallet/ledger schemas can now be written; payment schemas stay gated. QR-01 must select a vetted local encoder rather than handwritten payment encoding; dependency addition needs an explicit implementation change and normal checks, not a planning install.

## Readiness for the next command

Ready for `$speckit-tasks`: P1 foundation and P2/P3 source-backed read integration are actionable, with runtime acceptance gates retained. P4 QR/policy UI/model preparation is bounded; public payment create/query/posting/recovery, renderer validation and channel proof remain gated. Do not write tasks against proposed Payment routes as if implemented. No tasks/implementation/index/branch changes are made by this replan.

This command stops after design. Documentation verification is recorded in [checklists/planning.md](checklists/planning.md). No source tests, live API/gateway calls or native acceptance were executed by planning.
