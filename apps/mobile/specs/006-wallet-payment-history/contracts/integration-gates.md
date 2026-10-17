# Integration gates and contract evidence

**P5 preparation checkpoint — 2026-10-17**: T044..T051 complete the local US3 observation/refresh/status/recovery-case scope only. Backend remains17e3ac1 without drift: Payments still has no operational owner query/create/posting/recovery. Normal status/Confirm and every Payment capability remain unavailable; no Payment DTO/HTTP adapter or provider traffic exists.22 independent US3/86 focused/382 regression tests and8 W groups establish model/UI behavior only. GAP-05 freshness remains unresolved: conflicting observations keep the previous snapshot stale, including PENDING→PAID and PAID→REFUNDED, until an authoritative permitted freshness mechanism is agreed. GAP-06 lost-ID/restart and QR-01 remain BLOCKED. T042/T043/T052..T062 are unchecked; no formal gate closure or T053+ checkpoint was performed.

**P4 preparation checkpoint — 2026-10-17**: T033..T041 complete as local model/UI/test work, with63 focused/359 full mobile tests and7 synthetic W observations. GAP-04 approved policy is reflected in exact input/review; this does not supply a persisted public quote. GAP-03/05/06 remain BLOCKED: no Payment controller/module/orchestration/query/posting/recovery drift from17e3ac1. Normal Confirm and quote/create/status/recovery flags stay off. QR-01 remains BLOCKED, with renderer/decoder prerequisites/assertions in [qr-validation.md](qr-validation.md); T038 prepares that specification without skipped-as-PASS tests and T042 remains unchecked. No A/G/NA/NI or T053+ acceptance was performed; P5 requires a separate invocation. Earlier checkpoints below are historical.

**Revised baseline**: `17e3ac1`, 2026-10-16. The earlier blanket statement that all wallet/payment APIs are absent is superseded. GAP IDs remain stable; source implementation, accepted policy and runtime acceptance are separate dimensions.

Read [wallet-http.md](wallet-http.md) for the actual three read contracts, [research.md](../research.md) for source evidence and [contracts.md](../contracts.md) for the current checkpoint. No payment endpoint is treated as implemented merely because spec009 proposes it.

## Disposition summary

| Gap    | Source/policy disposition                                | Implementation planning                                    | Acceptance status                                                     |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| GAP-01 | Owner wallet HTTP implemented                            | P2 ready against actual DTO                                | Mobile/deployed read evidence pending                                 |
| GAP-02 | Owner list/detail HTTP implemented                       | P3 ready with limit20, sequence cursor, type/referenceType | Mobile/deployed read evidence pending                                 |
| GAP-03 | payOS QR-only selected; pure adapter implemented         | QR UI/model preparation; real create off                   | Public payment API, local encoder/decoding and merchant proof pending |
| GAP-04 | Approved bounds/step/TTL and pure quote rule implemented | Use policy, do not reopen settled limits                   | Persisted public quote/readiness projection still pending             |
| GAP-05 | No operational owner payment query/posting               | Status UI models only                                      | Backend receipt/posting/query/expiry/verification pending             |
| GAP-06 | No payment-specific durable creation/recovery            | Intent model tests only                                    | Payment keys/replay/lost-ID/restart proof pending                     |
| GAP-07 | Actual ledger reversal/ref/delta fields                  | Basic supplied read context available                      | Refund execution/partial/cash interpretation unsupported              |
| GAP-08 | Actual operation reference fields                        | Raw safe reference display available                       | Destination authorization/held allocations still gated                |

## GAP-01 — Owner wallet read: source available

- **Source**: `services/api/src/modules/credit/presentation/http/wallet.controller.ts:33–45`, `credit.module.ts:24`, `application/use-cases/get-wallet.use-case.ts:18–25`.
- **Request/ownership**: GET `/api/v1/me/wallet`, authenticated current identity and current actor; owner comes from principal, no userId query. Public response does not contain owner ID; capture authenticated owner/generation in the request scope.
- **Response/units**: `availableCredit`/`heldCredit` two-decimal Credit strings plus integer `walletVersion`. No public freshness timestamp/purchased/bonus. Absent row returns virtual zeros/version0 after authorization, with no row creation or bonus grant.
- **Errors**: Reuse current auth/session/account error behavior. A network/protocol/denied request is never mapped to virtual zero. Confirm actual deployment/migration and owner-read behavior in acceptance.
- **Gate**: P2 adapter/schema can now be implemented. Real environment acceptance remains pending; no need to wait for operational payment APIs.

## GAP-02 — History/detail: source available

- **Source**: WalletController:48–66; `wallet.dto.ts:18–39`; `application/contracts/wallet.ts`; `list-credit-transactions.use-case.ts`; `infrastructure/persistence/prisma-wallet.repository.ts`; `domain/ledger-cursor.ts`.
- **Request/ownership**: GET `/api/v1/me/wallet/transactions`, query `limit`, `cursor`, `type`, `referenceType` only. GET `/transactions/:id` validates UUID and scopes repository predicate to principal user + ID. Missing/nonowner gives404 `CREDIT_TRANSACTION_NOT_FOUND`.
- **Projection**: Actual magnitude/deltas/post-balances, ID/operation/type/status/time/reference/reversal fields are documented in wallet-http. No fixture description/combined reference or response owner/entrySequence is required.
- **Pagination decision**: BE accepts1–100/default20. Mobile parser accepts1–50. Explicit mobile limit20 keeps the shared parser unchanged. Do not request/advertise51–100 support or silently relax all consumers.
- **Order/snapshot**: Descending per-wallet entrySequence, not timestamp. First page captures watermark; subsequent signed opaque cursor binds owner/type/referenceType and boundary. It is not session/limit bound and has no agreed client TTL. New appends appear after a cursor-free refresh; rebuild continuation chain. Invalid/tampered/cross-owner/filter cursor gives400 `INVALID_LEDGER_CURSOR`.
- **Filters**: No status/date/search query. Amend mobile story/FR-016 to type/referenceType controls; retain status display only. Global whitelist rejects unsupported status instead of ignoring it.
- **Gate**: P3 implementation ready from source contract. Environment migration/read proof and mobile snapshot/filter/precision/owner tests remain pending.

## GAP-03 — payOS QR protocol available; creation still blocked

- **Accepted design**: payOS only, QR rendered inside SkillHub. `payments/application/contracts/payment-gateway.ts:22–28` and `infrastructure/payos-gateway.ts` implement a pure verified descriptor `{paymentLinkId,qrCode,orderCode,providerStatus}`. It is not an operational payment API.
- **Missing operation**: No payment controller/module/REST transport/persisted creation/status orchestration in source. spec009 POST/GET `/payments` and webhook routes remain proposed; T014..T018 are not completed.
- **Future public projection**: Must confirm owner ID association, persisted amount/rate/policy/expiry, QR preparation/nullable semantics and safe errors from actual implemented DTO. Do not copy the proposed HTTP example as live wire data.
- **QR rendering gate QR-01**: Existing react-native-svg is a renderer, not an encoder. Select a vetted local encoder with version/license/native-web compatibility, preserve exact payload bytes, and independently decode to the same payload. No new dependency installed now, no homemade payment encoder or remote QR service.
- **UI boundaries**: No hosted checkout URL, Linking/WebView/image-URL interpretation, mobile return/cancel screen, scanner permission, bank-app deep link, QR save/share or cancel mutation. Product must confirm a usable scan/payment workflow, including same-device limitations, before end-to-end acceptance.
- **Gate**: P4 QR UI/model tests can be prepared. Real create stays disabled until orchestration/quote/GAP-05/06 and merchant proof exist. A local QR failure preserves known payment/status; it never creates a replacement payment.

## GAP-04 — Amount/TTL decision and pure implementation available

- **Source**: `services/api/src/modules/payments/domain/top-up-policy.ts:5–27`, backend spec009 policies G02. Version `2026-10-15-v1`: minimum1,000, maximum2,000,000 VND, step1,000; 60-minute immutable quote; rate1,000 VND/Credit. No rounding mode is needed to accept off-step amounts: the current policy rejects them.
- **Client behavior**: Validate reviewed input against this approved policy, label estimated versus backend-confirmed Credit, and keep server final authority. Do not promote old preview presets into an approved product catalog.
- **Remaining projection**: Payment persistence/quote API must expose its accepted snapshot/readiness and server expiry when implemented. Do not infer expiry from mobile receive/create time, refresh TTL on retry, or mark a payment expired from a countdown.
- **Gate**: Policy is no longer an open Product question. P4 real activation still depends on missing operational contracts; recording a policy is not a working payment flow.

## GAP-05 — Payment query, verification and atomic posting: blocked

- Persisted Payment enum/model and pure signed-response/webhook verification do not implement owner query, durable receipts, TOP_UP posting or recovery. Backend spec009 T014..T018/validation explicitly retain these gaps.
- Confirm actual owner Payment API/DTO/status/freshness/expiry behavior before live adapter work. `providerStatus` from QR preparation is not owner Payment status; even its PAID value cannot authorize a mobile success display or wallet update.
- Backend must demonstrate verified owner Payment outcome, immutable quote matching, durable receipt, atomic PAID/TOP_UP/wallet/audit/outbox and duplicate/out-of-order/crash/late/partial behavior. No new backend code or provider call is authorized here.
- Manual owner status checks remain the intended baseline after query API exists. SSE/polling named in backend design is not mobile infrastructure or a live event contract. No interval/backoff/client expiry is invented.
- **Gate**: P5 real adapter and P4 live financial continuation blocked. Local QR state and payment state remain separate; PAID refresh failures do not undo success.

## GAP-06 — Payment idempotency and recovery: blocked

- Generic idempotency/path keys and payOS evidence digest do not provide payment request scope, persisted key/replay/conflict/retention, lost-response lookup or process-restart recovery.
- A provider orderCode must eventually be allocated/persisted uniquely server-side; mobile cannot use Date.now/UUID slicing or matching amount to find the payment. The raw descriptor orderCode is not permission for provider lookup from the client.
- Require actual same-intent reconciliation/lost-ID/owner reauth/restart contract and deployment evidence. Retain runtime synchronous claim, immutable snapshot, unknown state and explicit `replayAfterRenewal:false`; no fresh-key shortcut or reconnect creation replay.
- **Gate**: P4 real creation and P5 durable recovery remain blocked. Known PENDING payment is distinct from unknown creation; this plan does not invent a universal one-pending-payment rule.

## GAP-07 — Reversal read context partial; financial semantics bounded

- Actual owner ledger projection includes status, deltas/post-balances, operation reference and nullable reversing transaction ID. P3 can show those supplied facts without waiting for a refund writer.
- Adjustment/reversal execution is still unavailable; no cash payout channel, partial-refund calculation, refund request or original-entry editing may be inferred from fields/enums. Future payment REFUNDED remains a not-yet-implemented owner observation.
- **Gate**: Basic ledger context available. Expanded refund explanation/execution is not authorized or required; optional absent context stays omitted.

## GAP-08 — Reference fields partial; related navigation still gated

- Actual owner ledger joins `referenceType/referenceId` via operation. Display safe reference fields, not invented human titles or per-path allocation from aggregate Held.
- A reference ID does not establish destination existence/authorization. Route to related features only after confirming supported real identity/projection and owner access; never feed real IDs into sample flows.
- No owner held-allocation read is implemented. Omit that drill-down independently of aggregate wallet/history readiness.
- **Gate**: Reference display can proceed; arbitrary deep links and allocations remain conditional.

## Activation/evidence record

### P1 implementation checkpoint — 2026-10-17 (T001..T011 only)

- HEAD/source baseline remains `17e3ac1f38df1b645bd5f103a7111eae00f5e0b4`; the mobile foundation is an uncommitted working-tree increment on `feat/mobile-wallet-payment-history`. Existing staged blobs/index are preserved. Controller/DTO/repository/cursor evidence above was rechecked; deployment, migration and configuration were not exercised.
- GAP-01/02 are **source available, mobile integration NOT_RUN**. The loopback fixture models only the three GET contracts, with explicit page20, type/referenceType and private snapshot cursors. It does not prove actual backend signing or deployed behavior. The shared pagination parser remains unchanged (mobile max50).
- `src/features/wallet/context/wallet-runtime.ts` separates wallet/history/transaction capabilities from quote/create/status/recovery. **All are false in the production P1 provider**, including source-ready reads, until their adapters are implemented in P2/P3. Capability-disabled is unavailable, never a successful zero.
- GAP-03/05/06 and QR-01 remain blocked. No Payment endpoint, live owner-read adapter, QR encoder, provider call, mutation, durable intent/recovery journal or backend change was added. Minimal payment types/preview states are local presentation models only.
- Exact money, owner/generation lifetime guards, scope cancellation/cleanup, denial projection, existing connection gate, isolated preview and Home unavailable have L/C/W evidence in [validation.md](../validation.md). Real API (A), provider channel (G), Android (NA) and iOS (NI) are NOT_RUN. This checkpoint completes foundation only; it does not close an entire financial FR/SC or T012+.

For each operational capability, retain source/contract version, migration/configuration readiness, safe fixtures, consumer compatibility choices and separately observed test results. Backend validation reports are prior reported evidence, not re-run results or proof of the user's deployed environment. New source/contracts or migration failures reopen the affected implementation/acceptance gate.

### P2 implementation checkpoint — 2026-10-17 (T012..T020 only)

- No backend source drift against the same SHA was found. GAP-01 now has mobile schema/adapter/query plus shared Wallet/Home UI, validated only by L/C/W. All money remains exact text; successful virtualzero is not an error fallback. No approved deployed owner API/migration/read test was run, so GAP-01 **real acceptance remains open**.
- The production provider enables **wallet-read only**. Home/Wallet share one owner/generation query; hidden consumers do not keep it active, including behind preview. Signals/current-scope guards, synchronous session cleanup, denial-only cache replacement, coalesced read refresh and existing ConnectionGate are verified for this increment. P1's all-off state above is historical.
- GAP-02 still has source-ready list/detail contracts and fixture controls but no mobile integration. limit20/max50 compatibility is unchanged. No History request, adapter, schema or UI was added.
- GAP-03/05/06 and QR-01 remain blocked; no Payment or QR encoder implementation. See [validation.md](../validation.md) for32 focused tests,328 full regression tests and9 P2 browser observations, separate from A/G/NA/NI and from still-unchecked T053+ checkpoints.

### P3 implementation checkpoint — 2026-10-17 (T021..T032 only)

- Backend/source contract remains17e3ac1 with no relevant drift. GAP-02 now has mobile list/detail schema, shared HTTP adapters, owner/filter/chain queries and read-only UI with L/C/W evidence; deployed migration/API and native acceptance remain open.
- Provider enables wallet/history/detail reads only. Hidden consumers do not remain active behind preview. List always sendslimit20 with optional type/referenceType/cursor; sharedmax50 stays unchanged. Atomic refetch rebuilds loaded continuations from new pageone cursors; failures retain the entire older snapshot. Filter/restart starts a new local chain incarnation.
- Denied lists erase every current-owner History filter/chain cache and its cancellation revert target; denied details contain no row and never fall back to a list. Supplied reference/reversal context is text only; GAP-07/08 do not authorize related navigation, refund execution or Held allocations.
- [Validation](../validation.md) records48 focused tests,344 regression tests and10 P3 web observations with a220-entry synthetic ledger. C/W do not establish backend HMAC/deployment/settlement or native behavior. T033..T062, including all T053+ checkpoints, remain unchecked. GAP-03/05/06, QR-01 and A/G/NA/NI acceptance remain gated/NOT_RUN.

The 2026-10-16 replan authorized documentation only; later scoped invocations authorized P1/P2/P3, P4 preparation T033..T041 and P5 preparation T044..T051. T042/T043/T052..T062 require a later scoped invocation and their own gates; Payment source/provider activation remains blocked. No blanket claim that all eight gaps are either absent or fully closed is accurate.
