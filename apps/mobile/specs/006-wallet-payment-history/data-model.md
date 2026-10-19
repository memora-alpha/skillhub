# Wallet and Payment data model

**Implementation checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Test-first eligible source batch is implemented. T043/T052/T076/T078..T088/T094 complete within DOC/L/C/W/source-check criteria;100 IDs,83 checked/17 unchecked, original68 completed task bodies preserved. Normal Payment/status/create/recovery/Confirm flags remain off. Private native QA read/financial entries are source-ready, not an activated or accepted deployment. Current fields, cleanup/store/claim/create/replay/QR/status replace earlier pending-source proposals below. D1/D2/D3/D4 are not reopened. Actual API/payOS/Android/iOS acceptance and full T100 stay gated; historical results keep their original scope.

## Current Payment/policy model delta — 2026-10-18

At7fc0f83/HEAD5101aea, D1 SOURCE_SYNC_REQUIRED is cleared; [current source audit](contracts/backend-review-7fc0f83.md) and [wire contract](contracts/payment-http.md) supersede older source-missing/policy-absent notes below. No runtime model code is edited in this replan.

| Entity/field                       | Required design delta                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PaymentProjection.recoveryRequired | Required boolean; current source true iff nonnull reason. Do not derive from checkout:null or change Payment status.                                                                                                                                                                                                                                                                                                                             |
| PaymentProjection.recoveryReason   | Required nullable string. Known missing-checkout/REVIEW/channel reasons, unknown-safe support/read-only handling. Metadata can change or clear at equal version from current read/config; not an immutable financial field.                                                                                                                                                                                                                      |
| CreationPolicy                     | Required canCreate:boolean, reasonCode:string/null, existingPaymentId:own UUID/null. No timestamp/version/reservation/quote. Unknown/inconsistent projections block create. Query scope must include environment/owner/session; no polling or mutation from reads.                                                                                                                                                                               |
| Observation safety                 | Current-ticket/owner/numeric-version rules remain; same-version metadata changes do not become financial conflicts, and accepted QR-null is latched at that version. Lower/old responses cannot restore QR. PAID plus recovery warning remains PAID.                                                                                                                                                                                             |
| Durable correlation                | Approved environment/owner/key/canonical body/dispatch marker/optional-ID; session generation RAM-only. No QR/credentials/provider/ledger fields. Persist/read-back before dispatch and block storage/capacity failure.                                                                                                                                                                                                                          |
| Cleanup/total loss                 | Only unresolved encrypted correlation survives logout without TTL; memory/cache/QR clear. Resolved classification and record/index deletion follow payment-recovery.md/FR-001 before successful logout cleanup. Failure/crash leaves cleanup incomplete, financial restore/create unavailable; T080 finalizes layout/order, not a BE retention SLA. Unknown total loss is support-stop, not amount/time reconstruction or replacement clearance. |

Existing mobile types/parser currently omit recovery fields. Update tests/fixtures before schema/types/reducer/UI; do not pretend old completed task evidence covers them. Preserve100 IDs/68 checked, D2 native-first, D3 tools and D4 workflow. Older sections below retain design history and baseline entities; current fields/limits above govern the new integration.

**D1 input — 2026-10-18:** [BE confirmation](contracts/d1-backend-confirmation.md) requires persisted owner/key/canonical body before the first POST and optional paymentId afterward; order/QR60-minute expiry is unrelated to mapping retention. Keep unresolved encrypted D2 records through logout with RAM/cache/QR eviction and owner isolation; do not invent resolved-record deletion timing or recovery after total loss. New backend Payment identity fields/policy DTO are declared but absent from local source, so no runtime schema/model addition is made in this documentation update.

**QR implementation checkpoint — T089..T093**: Ephemeral QR projection now accepts only current owner/generation/known-ID accepted observation, PENDING checkout and no stale/conflict/suppressed version. It never evaluates local expiry or providerStatus as outcome. Same-version null remains latched by existing reducer; wrong scope/disposal/denial produces no raw QR. Encoder result contains frozen matrix/geometry only, no raw payload/Payment status. Local render failure/retry/close does not change identity/financial state. Synthetic preview owns private state, not account cache; no durable record/storage or create implementation was added.

## Clarified completion design — local record, not a backend DTO

[D1..D4 decision record](contracts/completion-proposal.md) retains implemented I1/I2 and63 completions. D2 approves native-first financial SecureStore separate from auth storage/cache, encrypted unresolved owner/environment correlation across logout, and web create unavailable. Local record remains the proposed format: version/environment/owner/key/two-field body/intent/dispatch marker/optional payment UUID; session generation is RAM-only. No balances/ledger/raw QR/provider payload/credentials are persisted. D1 cleanup/replay/total-loss policy remains incomplete; no storage implementation exists.

Local marker `DISPATCH_MAY_HAVE_OCCURRED` belongs to the planned storage model, never backend status. Write/read-back before POST is conservative, not atomic storage+network. Failed ID storage cannot turn a valid Payment into failure. D2 explicitly keeps only encrypted unresolved A correlation for reauthenticated A while clearing runtime/cache/QR immediately; B cannot read/enumerate A. No deletion TTL/replay horizon is invented. Corruption/read errors block create; undetectable total loss still needs D1 BE/operator handling.

D3 selects qrcode1.5.4/existing SVG and independent dev-only jsqr1.4.0/pngjs7.0.0; review/source/byte/W pixels are now observed, while device/native/channel checks remain open. QR input remains ephemeral/raw; server QR-null/version authority is unchanged. D4 approves two-device QA entry and reports environment available, without verified binding or financial evidence. See the decision record for source audits and deferred constraints.

**Revised**: 2026-10-17, source `4121c3f` (Payment `081b3d2`, merge `f80ef7a`) versus `17e3ac1`. Existing P1..P5 source is preserved; this design identifies the adaptations needed before integration. [Payment HTTP](contracts/payment-http.md) is the wire authority, not the synthetic models.

## Owner/session scope and private read lifecycle

A runtime scope contains authenticated owner identity and session generation captured before dispatch. No current Payment or Wallet response supplies owner. Query identity includes feature, owner/generation, resource and applicable filters/chain/ID. Requests forward AbortSignal and carry a request ticket; accepted responses must still match the current scope and target.

Logout/account switch cancels requests/observers, invalidates tickets, disposes private views/drafts/raw QR and removes financial cache. A late result/error cannot populate another session or resurrect denied data. Owner403/404 evicts the affected projection and any fallback, including cancellation reversion. Reconnect recovers active reads through existing connection handling; never queues/replays creation. Abort is not proof that the server did not commit.

Read states distinguish unavailable, loading, confirmed data, confirmed zero/empty, stale data with refresh issue, error and denied. Successful virtual zero is data; unavailable or missing fields are not zero. Back/retry actions and accessible labels do not depend on color.

## Preserved P1/P2/P3 entities

| Entity            | Actual fields and invariants                                                                                                                             | Source / implementation                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Wallet snapshot   | availableCredit/heldCredit exact two-decimal strings, walletVersion integer. Missing physical row after successful authorization gives0.00/0.00/version0 | [wallet HTTP](contracts/wallet-http.md); mobile schemas/wallet-contracts.ts, api/wallet-api.ts, utils/wallet-query.ts |
| Ledger entry      | ID/operation/type/status/time, amount magnitude, signed Available/Held deltas, recorded post-balances, nullable reference/reversal fields                | Same contract; schemas/transaction-contracts.ts, api/transaction-api.ts                                               |
| Ledger page chain | Explicit20; backend order; opaque cursor; owner + type/referenceType + local chain identity. Fresh pageone rebuilds continuations atomically             | utils/history-query.ts; no shared parser change                                                                       |
| Related context   | Supplied referenceType/referenceId/reversal only                                                                                                         | Text-only unless destination authorization is separately established                                                  |

Never infer signed delta from transaction type or reconstruct balance/settlement by summing pages. Held is not withdrawable. GAP-07/08 remain bounded read-only context.

All mobile paths in entity/design tables below are relative to `apps/mobile/src/features/wallet/`.

## Input draft and creation intent

Draft stores canonical integer VND text and PAYOS. Approved validation is1,000..2,000,000/step1,000 VND. Review shows standard1000VND/Credit conversion as an **estimate** before create. No rounding or fabricated policy lookup.

P4's QuoteModel/quoteId/policyVersion/expiry are explicitly local synthetic preparation, not a public quote DTO. The actual backend confirms quote fields only in the created Payment. Do not expose invented quoteId/policyVersion, calculate expiry from receipt time or reset TTL on replay.

Intent must retain reviewed immutable body, stable idempotency key, scope, dispatch/outcome and optional confirmed ID. Current `utils/payment-intent.ts` uses local model-intent-N identity, not a real HTTP idempotency key. Future key generation/persistence must be separately designed under GAP-06; this document does not select storage or retention.

| Intent outcome                                     | Safe transition/action                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Draft/review, not dispatched                       | Edit or Back preserves input; explicit Confirm needed                                                             |
| Synchronously claimed, then dispatched             | One active caller across remount; freeze body/key before await                                                    |
| Confirmed created with ID                          | Bind returned ID and quote; status GET handles CREATED/PENDING/PAID/REVIEW etc.; missing QR keeps ID              |
| Proven rejection with no prior unresolved dispatch | Explain policy/eligibility/config issue; correction requires explicit review                                      |
| UNKNOWN_OUTCOME                                    | Preserve frozen body/key/known ID, block new intent; permitted owner read or explicit same-key/body recovery only |
| Owner denied/session disposed                      | Clear visible private state and active requests; durable recovery behavior awaits approved policy                 |

Timeout, lost response, abort, protocol failure, generic409/429/5xx and renewal do not prove no creation. Provider-disabled503 also occurs before replay lookup. No new key/body on reconnect, foreground, auth renewal or unproven failure.

## Actual Payment observation and mapping

Actual flat fields: id, gateway, status, paymentAmountVnd, currency, creditAmount, conversionRateVndPerCredit, createdAt, expiresAt, paidAt, version, checkout. Types/nullability and source references: [payment HTTP](contracts/payment-http.md). DTO has no response owner, nested scope/payment, policyVersion, quoteId, as-of or review reason.

Future wire schema validates identity, exact strings, numeric safe version/rate, ISO/null fields and checkout null/descriptor. The adapter binds locally captured scope after parsing; it does not invent fields as if returned by the server. Known-ID owner reads must work independently of a top-up draft or intent: use the authorized response's quote, never require route amount or prior US2 state.

P5 local association history is retained: “Requested identity must match the returned projection and authenticated owner; reject mismatches. Use confirmed snapshot, not route amount. Do not silently reinterpret a changed quote.” Its implementation `utils/payment-outcome.ts` currently expects injected scope/payment plus expected quote and keeps any differing observation stale; this is valid preparation evidence, **not the new live adapter**.

### Status interpretation

| Backend state    | Mobile meaning / permitted next action                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| CREATED          | Reserved/preparing; known ID, manual owner read                                             |
| PENDING          | Awaiting verification; QR available only when server supplies checkout                      |
| PAID             | Backend verified/posting confirmed; refresh Wallet and History independently                |
| FAILED           | Confirmed failure; explain and Back; no automatic new payment                               |
| EXPIRED          | Backend reports expired; no client clock transition; newer authoritative PAID still allowed |
| REFUNDED         | Backend reports refund state; no inferred cash-out/partial amount or refund execution       |
| REVIEW           | Needs checking/reconciliation; neutral wording, Check again; never “failed/no creation”     |
| Unfamiliar state | Neutral unconfirmed outcome with read retry; no false success                               |

There is no client transition ranking. Numeric version orders same-payment persisted observations; higher accepted, lower ignored, equal conflicts stale. Immutable ID/amount/Credit/rate/currency conflicts never authorize replacement creation. Request ticket/scope checks precede version comparison.

**Time-sensitive exception**: server can hide checkout at equal version when server expiry passes. Accept checkout:null suppression without changing status; retain a per-session/payment no-restore guard against late equal/lower QR. Newer valid owner projection may replace it. Missing QR is not proof of EXPIRED/FAILED, and local countdown is not financial authority. See actual read projection in payment-http.

## QR presentation

A QR model contains owner/session/payment identity, accepted observation version, raw payload only while permitted and preparation/render/error/closed state. Renderer retry is separate from read retry; neither creates a payment. Close hides/clears raw QR but preserves active-session known payment access. Null checkout shows preparation/not-available context with Check again and Back.

The current component is a labeled shell; react-native-svg is not an encoder. QR-01 requires approved local encoder, independent decode and byte/Unicode/capacity/layout/native observations. No remote QR, WebView, bank deep link, save/share or scanner is implied.

## Payment discovery page

Future optional recovery discovery uses a separate owner/session/status/chain key and Payment DTO. Explicit limit20, orderCode-descending server order, opaque owner/status cursor, refresh/filter reset and ID dedupe. It cannot reuse the ledger type/referenceType query or claim immutable status membership. A chosen row leads to an owner detail GET. Multiple equal-amount orders may exist; no automatic lost-intent matching.

## Refresh result

Payment result, Wallet read result and History read result are independent. Existing `utils/payment-refresh.ts` accepts injected reads; later bind real feature reads/cache invalidations without deriving a wallet or ledger locally. A PAID observation survives either/both refresh failures, while displayed stale/failed dependent data has its own retry. No create, local Credit increment, synthetic TOP_UP or settlement.

## Recovery record and unresolved decisions

Known-ID GET and retained same-key/body replay exist on BE; no GET-by-key. Foundation R-07 specifies no automatic TTL, but operational exceptions/restore and total-loss recovery remain D1. Current memory model does not prove process-restart recovery. D2 now selects a native financial SecureStore record and owner/logout/platform boundaries; it remains unimplemented, with final cleanup/replay policy deferred. Never persist raw QR/provider secrets/credentials or repurpose auth-token storage.

[Recovery contract](contracts/payment-recovery.md) specifies known-ID/lost-ID and A/B relogin cases. Until the activation gate is satisfied, real creation/recovery remains disabled even though schema and owner-read integration can be prepared independently.

Current T080 implementation contract: one SHA-256 owner/environment SecureStore slot is the bounded index (one unresolved intent, <2048 UTF-8 bytes including envelope); cleanup tombstone/read-back/delete, single JS writer, no TTL/prune or global enumeration. Full layout/failure matrix is in contracts/payment-recovery.md, finalized before T081. This replaces earlier pending-layout proposals without claiming native durability or BE retention SLA.
