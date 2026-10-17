# Research: Wallet, payment status and transaction history

**Date**: 2026-10-16. **Baseline**: `17e3ac1f38df1b645bd5f103a7111eae00f5e0b4`.
**Method**: SRS V1.6 review, current source inspection and research audits requested by the plan skill. This update supersedes the earlier `92c923e` backend findings. No live endpoint/database/provider call or runtime test was executed here; changes are mobile design Markdown only.

## Evidence classification

- **SRS** is required product behavior, not proof of implementation.
- **Source** proves a particular local implementation at this commit, not a deployed endpoint or financial runtime outcome.
- **Fixture** proves sample UI/test intent only.
- **Design** below is a proposed mobile decision, not an existing implementation or an agreed wire contract.
- **External dependency** remains blocked until the listed owner supplies actual contract/policy/evidence. An absence is not repaired by inventing an API.

Current authority: [SRS V1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), sections 6.7, 18.14..18.16, FR-CR-01..09, CR-001..010, PAY-001..005, UC-19 and AC-11. Subsequent backend [spec009 policies](../../../../services/api/specs/009-credit-payment/policies.md) records selected payOS, QR displayed inside SkillHub, 1,000–2,000,000 VND in steps of 1,000, and immutable quote TTL 60 minutes. Amount constants/TTL have a pure domain implementation; no live quote or persisted expiry is implied. Wallet/history remain owner-private, effects backend-owned, no cash-out/per-Session settlement. Backend decision records and reported prior validation are evidence categories distinct from source/runtime evidence; this mobile plan does not activate provider/configuration or rerun their tests.

## Source evidence catalog

Paths are repository-relative; line numbers were checked at this baseline. They are anchors for review, not claims about future deployment.

| ID  | Source evidence                                                                                                                                                                                                                                                                                           | Finding and limit                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | services/api/src/modules/credit/credit.module.ts:22–43; services/api/src/app.module.ts:36,85; services/api/src/modules/credit/presentation/http/wallet.controller.ts:26–67                                                                                                                                | Real authenticated aggregate/list/detail GETs now exist. Payments inventory contains pure contracts/config/policy/adapter only; no controller/module/transport/orchestration.                                    |
| E02 | services/api/src/modules/credit/application/use-cases/get-wallet.use-case.ts:17–26; services/api/src/modules/credit/presentation/http/wallet.responses.ts:13–17; services/api/src/modules/credit/infrastructure/persistence/prisma-wallet.repository.ts:28–44                                             | Owner GET returns decimal Available/Held and walletVersion; missing row returns virtual zero/version0 without creating wallet or granting Credit.                                                                |
| E03 | services/api/src/modules/credit/presentation/http/wallet.responses.ts:19–35; services/api/src/modules/credit/application/services/ledger-entry.mapper.ts:4–19; services/api/src/modules/credit/infrastructure/persistence/prisma-wallet.repository.ts:10–24,47–85                                         | Actual ledger amount/deltas/post-balances/reference/reversal/time projection; detail predicates owner and ID. No related-feature access follows from reference ID.                                               |
| E04 | services/api/prisma/schema.prisma:174–215,849–866; services/api/src/modules/payments/application/contracts/payment-gateway.ts:22–43; services/api/src/modules/payments/infrastructure/payos-gateway.ts:138–195                                                                                            | Persistence enums remain distinct from absent Payment HTTP/recovery/expiry. Pure adapter returns QR descriptor or candidate event; no persisted financial status/posting.                                        |
| E05 | services/api/src/modules/credit/domain/money.ts:6–22,32–47; services/api/src/modules/payments/domain/top-up-policy.ts:5–27; services/api/specs/009-credit-payment/policies.md:24–26                                                                                                                       | Read wire Credit is exact decimal text formatted from bigint hundredths. Selected top-up helper enforces 1,000..2,000,000 VND, step1,000, rate1,000 and TTL 60m. No live quote/policy route or persisted expiry. |
| E06 | services/api/src/infrastructure/idempotency/idempotency.service.ts:80–134; services/api/src/modules/credit/application/services/credit-ledger.service.ts:14–19; services/api/specs/009-credit-payment/tasks.md:37–41                                                                                      | Generic replay/path identity exist; Payment reserve/replay/receipts/posting/recovery tasks remain unchecked. GET reads need no mutation key.                                                                     |
| E07 | services/api/src/shared/http/response.ts:3–18,56–62; services/api/src/modules/credit/domain/ledger-cursor.ts:31–67; services/api/src/modules/credit/application/use-cases/get-credit-transaction.use-case.ts:17–23; services/api/src/modules/users/application/services/skill-actor.service.ts:56–89      | Implemented envelopes, INVALID_LEDGER_CURSOR 400, missing/nonowner detail 404, live session and ALL-restriction checks. Read errors imply no Payment no-creation guarantee.                                      |
| E08 | `apps/mobile/src/features/wallet/screens.tsx:25–40,54–74,95–148,159–196,225–243`; `apps/mobile/src/features/wallet/fixtures.ts:1–50`                                                                                                                                                                      | Current wallet uses labeled sample balances, local amount rules/sandbox/URL-state selector and static history. No actual financial API calls.                                                                    |
| E09 | `apps/mobile/src/features/home/mocks/home.ts:13–24`; `apps/mobile/src/features/home/components/HomeContent.tsx:32,64–66`; `apps/mobile/src/features/profile/components/ProfileLayout.tsx:108–110`; `apps/mobile/src/constants/navigation.ts:23`                                                           | Home's account balance is sampled; Profile already navigates to `/wallet`. Stale notice copy at ProfileLayout:38–39 is not proof the shortcut is disconnected.                                                   |
| E10 | `apps/mobile/src/lib/http/client.ts:6–16,31–32,90–130`; `apps/mobile/src/providers/QueryProvider.tsx:7–16`                                                                                                                                                                                                | Shared HTTP supports signal/key/generation guards; it replays after token renewal unless explicitly disabled. Query `retry:false` does not disable that replay.                                                  |
| E11 | `apps/mobile/src/features/auth/context/AuthSession.tsx:48–54,85–96,111–116`; `apps/mobile/src/features/auth/context/session-controller.ts:108,171–185`                                                                                                                                                    | One authenticated client/runtime; generation changes on login/expiry; account cache cleanup exists. No global cleanup of all future feature caches.                                                              |
| E12 | `apps/mobile/src/features/learning-requests/context.tsx:21–41`; `apps/mobile/src/features/skills/context/SkillsProvider.tsx:149–181`; `apps/mobile/src/features/profile/hooks/use-public-profile.ts:24–32`                                                                                                | Owner/generation feature cleanup and query-signal forwarding precedents exist. Canceling queries alone is not proof a given adapter forwards AbortSignal.                                                        |
| E13 | apps/mobile/src/providers/use-app-connection.ts:26–49,51–66; apps/mobile/src/providers/ConnectionGate.tsx:11–26; apps/mobile/src/lib/http/response.ts:35–64; services/api/src/modules/credit/presentation/http/wallet.dto.ts:17–39                                                                        | Recovery refetches active reads with routes mounted. Mobile parser accepts limit 1..50 versus backend1..100/default 20; explicit mobile limit 20 reuses it without shared changes.                               |
| E14 | `apps/mobile/src/components/feature-page.tsx:14–22,32`; `apps/mobile/src/components/data-form.tsx:72–78`; `apps/mobile/src/features/shell/components/AppScreenLayout.tsx:89,120–125`; `apps/mobile/src/features/ui-preview/screens.tsx:80–86`; `apps/mobile/src/features/product-shell/context.tsx:29–33` | FeaturePage defaults to demo and a scroll wrapper; DataForm is synchronous; shell supports feature-owned content. Gallery/sample links need explicit isolation when real routes change.                          |
| E15 | `apps/mobile/tests/http-client-session-boundary.test.ts:91–185`; `apps/mobile/tests/learning-requests-pagination.test.ts:24–227`; `apps/mobile/tests/fixtures/learning-requests-api.ts:72,81,629–655`; `apps/mobile/scripts/check-structure.mjs:9–15,31–39`                                               | Deferred races, loopback fixtures and pagination tests are existing patterns. Source structure checks enforce maxima looser than documented design targets; follow the stricter targets.                         |
| E16 | apps/mobile/package.json:5–65; apps/mobile/app.json:25; apps/mobile/src/features/ui-preview/provider.tsx; services/api/specs/009-credit-payment/contracts/gateway.md:9–13                                                                                                                                 | Linking/scheme is inventory; selected QR-only flow renders data locally without hosted checkout. UiPreviewProvider also hosts live RequestsProvider, so its name alone is no fixture boundary.                   |
| E17 | services/api/src/modules/credit/domain/ledger-cursor.ts:18–67; services/api/src/modules/credit/application/use-cases/list-credit-transactions.use-case.ts:19–60; services/api/src/modules/credit/infrastructure/persistence/prisma-wallet.repository.ts:54–66                                             | HMAC binds owner/type/referenceType/watermark/before; descending per-wallet entrySequence excludes later appends. No limit/session binding or TTL. Refresh without cursor starts a new chain.                    |
| E18 | services/api/prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql:1–73; services/api/specs/009-credit-payment/validation.md:37,78–92,124–133                                                                                                                                           | Strict legacy preflight, sequence backfill/row-lock assignment and immutable transaction guards; prior isolated PG/HTTP results are reported, application migration/deployment still pending.                    |
| E19 | services/api/src/modules/payments/domain/payment-config.ts:10–36; services/api/src/configs/environment.ts:2,106; services/api/src/modules/payments/infrastructure/payos-gateway.ts:76–157; services/api/specs/009-credit-payment/validation.md:94–118                                                     | Disabled-by-default config startup validation and pure signed REST preparation/QR-only verified projection. No actual REST transport/channel readiness from adapter tests.                                       |

## GAP disposition at the current baseline

| Gap    | Confirmed now                                                                                         | Remaining gate                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| GAP-01 | Owner aggregate HTTP source contract and virtual-zero semantics.                                      | Mobile integration, target migration/SHA/environment and owner-read acceptance.                         |
| GAP-02 | Owner history/detail source contract, decimal fields, sequence cursor and type/referenceType filters. | No status/date filter, safe reason or related destination contract; mobile/real-environment acceptance. |
| GAP-03 | payOS QR-only selected; pure QR adapter implemented.                                                  | Operational creation/query/QR persistence/REST transport and merchant evidence missing.                 |
| GAP-04 | Bounds/step/rate/TTL selected; pure policy helper implemented.                                        | No quote/policy HTTP, immutable persisted quote/expiry or provider-expiry runtime proof.                |
| GAP-05 | Pure signature verification exists.                                                                   | Owner Payment read, durable receipts, atomic PAID/TOP_UP/wallet, callbacks/runtime evidence missing.    |
| GAP-06 | Generic keys and proposed backend design exist.                                                       | Payment-specific reserve/replay/lost-ID/restart/lookup recovery incomplete.                             |
| GAP-07 | Ledger reversal ID/status supplied.                                                                   | Financial effects, public context and operational refund/reversal pending.                              |
| GAP-08 | Owner operation reference type/ID supplied.                                                           | Destination permission/existence and held-allocation owner read unresolved.                             |

Neither blanket all-gaps-open nor all-gaps-closed is accurate. Confirmed read contracts are captured in [wallet-http.md](contracts/wallet-http.md); operational activation remains distinct.

## Decisions, rationale and alternatives

### R-01 — Bind confirmed reads; gate payments independently

**Decision**: Use the three implemented read endpoints and exact projection in [wallet-http.md](contracts/wallet-http.md). Payment adapters remain gated; spec009 proposed Payment routes are future design.
**Rationale**: E01..E07 establish owner read contracts; E19 is a pure provider adapter.
**Alternatives considered**: Preserve stale absence claims or implement proposed Payment routes as live HTTP; both contradict source.

### R-02 — One session wallet runtime and shared balance

**Decision**: Provider lifetime uses owner ID + controller generation; Home and wallet use one public balance consumer/query key. Remove wallet scope on disposal; forward signals and guard session plus request sequence.
**Rationale**: E09..E13; only account cache is automatically cleared, and cancellation cannot stop all late results/server work.
**Alternatives considered**: Local state in six screens, Home fixture fallback, clearing all app caches. Rejected for inconsistency, leakage risk or unnecessarily broad impact.

### R-03 — Preserve exact decimal-string reads

**Decision**: Wallet/history money is already Credit text with exactly two decimals. Validate/format text without Number coercion or another /100 division. Keep positive amount separate from signed deltas and nonnegative post-balances. Do not impose top-up input bounds on historical values. Future VND quote transport still needs its actual HTTP contract.
**Rationale**: E02/E03/E05 now establish read wire scale. TOP_UP_POLICY is not an HTTP quote.
**Alternatives considered**: Universal subunit wire assumption, floats or importing backend helpers.

### R-04 — Immutable explicit intent with synchronous runtime claim

**Decision**: A user confirmation creates one intent identity and frozen amount/method snapshot. Take a runtime lock before awaiting; preserve identity through remount. Identical amounts can later be separate explicit intents; matching body/amount is not recovery.
**Rationale**: E06/E10 and SRS idempotency; a disabled button alone cannot protect remount or unknown outcomes.
**Alternatives considered**: Per-component pending flag only; dedupe by amount; new key on every retry. Rejected because legitimate identical top-ups differ and ambiguous retries must not become new payments.

### R-05 — Opt out of shared HTTP renewal replay for creation

**Decision**: Creation explicitly requests `replayAfterRenewal:false`; Query mutation retry stays false. Only a subsequently confirmed payment-specific replay contract could justify changing it. No global HTTP modifications.
**Rationale**: E10 proves two independent retry layers. Renewal may succeed while creation result remains uncertain.
**Alternatives considered**: Trust global Query defaults or automatically replay with a header alone. Rejected: transport support does not prove payment endpoint semantics.

### R-06 — Unknown creation is a first-class blocking state

**Decision**: Timeout/network failure, abort after dispatch, malformed response after dispatch or uncertain server error preserves intent and blocks new submission pending agreed reconciliation. A confirmed pre-dispatch validation/rejection can return to draft only when no-creation semantics are established.
**Rationale**: E10 HTTP errors do not expose proof of non-commit. GAP-06 must include lost-ID and restart recovery before real creation is enabled.
**Alternatives considered**: Mark failed on timeout, cancel request to undo server work, regenerate key after reconnect. Rejected for duplicate risk. No durable journal/recovery endpoint is chosen without agreement.

### R-07 — QR/provider evidence and financial result are separate

**Decision**: QR preparation/rendering, providerStatus and verified adapter event do not establish persisted Payment PAID. Only eventual authorized Payment API observations establish success; PAID triggers read refresh and refresh failures stay separate.
**Rationale**: E04/E19; adapter outcome PAID is candidate signed evidence requiring stored quote/channel matching and atomic posting.
**Alternatives considered**: Success from QR/provider enum/URL parameter, optimistic balance or synthesized TOP_UP.

### R-08 — Manual checking first; quote TTL is not a polling budget

**Decision**: No scheduled interval selected. After owner status exists, manual checks/known-ID refresh are baseline; automatic checking needs finite budget/rate handling. Selected server quote TTL 60m does not allow mobile to mark Payment EXPIRED.
**Rationale**: GAP-05/06 operational timing/freshness/recovery remains incomplete despite selected amount/TTL policy.
**Alternatives considered**: Endless polling, client-clock expiry or new create after waiting.

### R-09 — Sequence snapshot pagination and supported filters only

**Decision**: Explicit mobile limit 20 reuses the existing page parser (max50 versus backend max100). Preserve server entrySequence order and opaque cursor with unchanged type/referenceType; never submit status. Filter change/cursor-free refresh starts a fresh chain; replace old pages after successful first page rather than mix watermark chains. Later-page failures retain pages; INVALID_LEDGER_CURSOR offers explicit cursor-free reload, not an automatic loop. Denial evicts private detail so older cache cannot resurrect it.
**Rationale**: E13/E17; server order is append sequence, not timestamp. Dedupe alone is not a completeness guarantee.
**Alternatives considered**: Shared parser widening, partial-page status filters, timestamp re-sort or mixed cursors.

### R-10 — Reuse shell/forms; isolate samples explicitly

**Decision**: Split the wallet monolith, preserve theme and existing routes. Use feature-owned virtualized history rather than nesting a list in FeaturePage's scroll. Use async-owned form composition; preview runs in a separate explicitly labeled host with no live payment client. Preserve Profile mapping; correct only stale checkpoint wording.
**Rationale**: E08/E09/E14/E16. Review `@expo/ui` before new native picker/menu/sheet choices; existing wrappers are not wholesale replaced.
**Alternatives considered**: New UI library, unlabelled fixture fallback, simply setting `demo=false` on unchanged sample data. Rejected for scope/truthfulness/performance.

### R-11 — Actual read errors without invented creation guarantees

**Decision**: Use shared AppError for read 400/cursor, 401 session, 403 restriction, 404 unavailable detail and safe transport/server failures. Cursor reload is read-only. Generic read/error status never proves a Payment was not created.
**Rationale**: E07 and [wallet-http.md](contracts/wallet-http.md); internal/provider exceptions are not automatically implemented public Payment error codes.
**Alternatives considered**: Retry every 5xx mutation, raw server text or all 4xx as fresh-create permission.

### R-12 — Separate prior backend evidence from current acceptance

**Decision**: Wallet HTTP fixtures may bind to confirmed source now; absent Payment APIs retain local model fixtures only. Record backend reported tests with revision/environment limits and execute mobile/native/real API/provider acceptance later.
**Rationale**: E18/E19 distinguish test schemas/pure adapters from deployed financial workflow.
**Alternatives considered**: Claim tests rerun here or merchant readiness from signer tests.

### R-13 — Follow the selected QR-only flow

**Decision**: Plan local rendering of trusted backend qrCode data, without hosted checkout navigation, arbitrary route URL or return/cancel page. Required server-only return/cancel HTTPS config remains provider payload input. Choose QR renderer/dependency during implementation after reviewing existing packages and operational Payment contract.
**Rationale**: E16/E19 and spec009 QR amendment supersede browser handoff assumptions; linking inventory is not a QR dependency.
**Alternatives considered**: Provider picker, WebBrowser handoff, QR-as-image-URL or redirect-derived success.

## Reported validation and current limits

Backend specs/009-credit-payment/validation.md:78–92 reports 86 distinct merge-compatibility cases including isolated PostgreSQL/HTTP suites; QR-only amendment at lines 113–118 reports 22 pure/regression cases, without rerunning PostgreSQL for unchanged persistence. These separate historical tranches must not be added or claimed as tests executed now. Application migration/deployment, provenance, Payment create/status/posting/recovery and live provider evidence remain pending at lines 124–133.

Migration requires complete zero-origin/history-order/Held-allocation preflight; it does not repair unexplained balances. Source availability does not prove a target environment has required columns/triggers or matching SHA. No endpoint probe, source/runtime test, financial operation, provider configuration or native check was executed here.

## Phase 0 disposition

Bind confirmed Wallet/history source contracts and selected provider/amount decisions. Operational Payment creation/status/atomic crediting/provenance/recovery remain gated. Optional refund/held/related navigation displays supplied facts only. Derive future tasks by confirmed capability; this mobile feature makes no backend changes.
