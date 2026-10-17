# Local data model and state ownership

**P5 implemented preparation — 2026-10-17**: Additional US3 types in `types/payment.ts` describe only `PaymentModelTarget` (current scope/exact expected identity and money), injected `PaymentModelReader`, `PaymentObservationRead` and independent related-read metadata. They are **not** actual Payment wire DTOs, freshness/version fields or quote APIs. `payment-outcome.ts` validates the scoped local receipt and maps unfamiliar states neutrally. `payment-observer.ts` captures/freeze-copies its target, coalesces one read per identity before notification, forwards AbortSignal and rejects retired/superseded work. Pause cancels without inventing an outcome; resume alone does not dispatch. Denial physically removes the projection and remains sticky through transport/protocol errors. Changed state/money/identity cannot silently replace the earlier snapshot; with no freshness contract, conflict is surfaced as stale rather than ranked by enum/client time.

`payment-refresh.ts` contains only PAID plus wallet/history completion/error/stale metadata, no balance/history entities or financial math. Each injected read settles independently, coalesces per resource, retries that read only and cannot alter PAID. Pause/disposal abort pending work; current-scope guards reject ignored-abort responses. Core runtime cleanup is tested by registering observer/refresh disposers, without changing WalletProvider or binding a live Payment reader. `payment-model-store.ts` is a local observable snapshot helper, not a Query/durable cache. Normal status never instantiates these controllers. Separate synthetic preview datasets exercise each state and refresh failures; they do not assert legal financial transitions. All owner reads/P4 behavior remain unchanged. Recovery after process loss stays BLOCKED; see [validation](validation.md) and [recovery contract](contracts/payment-recovery.md).

**P5 implemented preparation — 2026-10-17**: Additional US3 types in `types/payment.ts` describe only `PaymentModelTarget` (current scope/exact expected identity and money), injected `PaymentModelReader`, `PaymentObservationRead` and independent related-read metadata. They are **not** actual Payment wire DTOs, freshness/version fields or quote APIs. `payment-outcome.ts` validates the scoped local receipt and maps unfamiliar states neutrally. `payment-observer.ts` captures/freeze-copies its target, coalesces one read per identity before notification, forwards AbortSignal and rejects retired/superseded work. Pause cancels without inventing an outcome; resume alone does not dispatch. Denial physically removes the projection and remains sticky through transport/protocol errors. Changed state/money/identity cannot silently replace the earlier snapshot; with no freshness contract, conflict is surfaced as stale rather than ranked by enum/client time.

`payment-refresh.ts` contains only PAID plus wallet/history completion/error/stale metadata, no balance/history entities or financial math. Each injected read settles independently, coalesces per resource, retries that read only and cannot alter PAID. Pause/disposal abort pending work; current-scope guards reject ignored-abort responses. Core runtime cleanup is tested by registering observer/refresh disposers, without changing WalletProvider or binding a live Payment reader. `payment-model-store.ts` is a local observable snapshot helper, not a Query/durable cache. Normal status never instantiates these controllers. Separate synthetic preview datasets exercise each state and refresh failures; they do not assert legal financial transitions. All owner reads/P4 behavior remain unchanged. Recovery after process loss stays BLOCKED; see [validation](validation.md) and [recovery contract](contracts/payment-recovery.md).

**P4 implemented preparation — 2026-10-17**: `types/payment.ts`, `utils/topup-policy.ts`, `payment-intent.ts`/`payment-intent-result.ts` and `context/payment-preparation.ts` implement only local models. Session-owned draft/review/intent is shared across route remounts, independent of Query server entities. Exact policy validation uses canonical integer text and bounded BigInt checks; estimate comes from the approved step/rate, never settlement. `QuoteModel` is an injected synthetic review fixture, not an operational DTO: copying it preserves its supplied expiry verbatim; changing it clears review. The client does not author expiry, extend TTL or decide a financial state.

`localId` is a session-local counter, explicitly **not** an HTTP idempotency key, backend identifier, orderCode or recovery token. Explicit reviewed confirmation claims synchronously before the inert boundary; model receipt acceptance requires the same owner/generation/local intent/review. Only an injected associated no-creation receipt permits correction; generic HTTP errors/malformed receipts enter UNKNOWN_OUTCOME. Interrupt/remount/reconnect cannot unlock it. A known identity permits a later deliberate new intent without assuming a universal pending ban. Retirement invalidates the ticket, aborts pending work, clears draft/quote/intent and ignores late success/failure. Strict-effect reactivation is a clean lifecycle, not durable reconciliation; live activation remains blocked after restart/reauth until GAP-06 exists.

`utils/payment-qr-model.ts` owns synthetic preparation/unavailable/ready-model/render-error state only. Close clears raw text while retaining the model ID; disposal clears both. `components/payment-qr.tsx` renders explanatory text, no QR matrix or raw payload. Preview models live separately from the account runtime/cache; normal Payment never consumes a route ID/QR/outcome. All Payment flags stay off. See [QR specification](contracts/qr-validation.md) and [validation](validation.md); P5 observation models below remain unimplemented.

**Status**: Design at `17e3ac1`, with P1/P2 implementation checkpoint2026-10-17. WalletSnapshot schema/GET/query and shared Home/Wallet are implemented; History/Payment models below remain future design where not covered by P1 primitives. Read the actual [wallet HTTP contract](contracts/wallet-http.md), [research.md](research.md), [contracts.md](contracts.md), [implementation validation](validation.md) and [integration gates](contracts/integration-gates.md). Public payment create/status/recovery routes remain absent; a provider protocol adapter does not supply them.

**P3 implementation checkpoint2026-10-17**: CreditTransaction/page/filter/detail are now implemented. History keys include owner/generation/type/referenceType/local chain incarnation; filter or explicit restart advances the incarnation. Within it, InfiniteQuery refetch atomically rebuilds loaded continuations from new first-page cursors; success replaces all pages and failure retains the whole older snapshot. Current-runtime selection/incarnation is UI state only, cleared on session end. Denial physically removes History pages across filters and leaves only a marker; detail uses its own row-or-denial cache with no list fallback. These local cache markers are not HTTP DTOs or another entity store. Future Payment models below remain gated, with no schema/API/QR integration. P3 L/C/W evidence does not establish deployed A or native acceptance.

P2 cache representation is a local union of an accepted WalletSnapshot or a denial-only marker without any money fields. It is not a wire DTO or second balance store. Query key `wallet/ownerId/generation/balance` is shared by Home/Wallet. Focus/configuration/session control query activity; cached data is hidden for disabled/retired scope. Denial erases the snapshot, and later transient failure cannot restore it. Real read/environment and native acceptance remain separate.

## Representation rules

| Value                      | Proposed local representation                                                               | Validation / authority                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VND draft                  | Editable text plus separately validated canonical positive integer digit text               | No decimal VND, sign, exponent or Number coercion. Approved payOS policy is 1,000–2,000,000 VND inclusive, step 1,000; a formatted display is not submitted input. Public quote/create integration remains gated. |
| Confirmed Credit magnitude | Canonical nonnegative decimal text with exactly two fractional digits, e.g. `0.00`, `12.34` | Wallet/history HTTP already returns Credit decimal strings at two decimals; do not divide by 100. Never truncate extra precision or round a failed projection into validity.                                      |
| Signed Credit delta        | Canonical signed decimal text, e.g. `-12.34`, `0.00`, `12.34`                               | Source field determines meaning; a positive transaction amount is not necessarily a positive Available delta. Normalize negative zero to zero without changing value.                                             |
| Conversion estimate        | Exact text plus `estimated` provenance                                                      | Approved policy uses 1,000 VND/Credit and step 1,000 VND. Display an exact estimate until an authoritative payment quote exists; reject unsupported values rather than round.                                     |
| Identity                   | Current session owner; contract-validated resource identifier                               | Transaction/detail UUID validation is confirmed. Payment public identity validation remains gated. Preview IDs are a separate namespace and never valid live identities.                                          |
| Creation time              | Confirmed timestamp value plus presentation formatting                                      | Ledger order is server entry-sequence descending, not timestamp sorting. Equal timestamps preserve returned order; the private sequence is not a response field.                                                  |
| Observation time           | Local receive time and request sequence                                                     | UI freshness metadata only; not payment settlement/expiry/server as-of time.                                                                                                                                      |

Use digit/text operations for input normalization and exact formatting. No new money package or backend helper import is planned. Do not infer Purchased + Bonus = Available + Held, total balance, fee, refund or settlement amounts. Those relationships require a contract and are not needed for these views.

## 1. WalletSessionScope

| Field/concept         | Source / role                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Owner ID              | Current authenticated session, not a route parameter.                                                                              |
| Generation            | Auth controller epoch captured at runtime creation.                                                                                |
| Current-session guard | Requires same owner/generation and ready/authenticated state before and after async work.                                          |
| Query scope           | Proposed local key prefix `wallet`, owner ID, generation; append capability/identity/filter as needed. Not a backend key.          |
| Read controllers      | AbortSignals forwarded through adapter/client; cancellation does not replace validity guards.                                      |
| Active intent         | At most one unresolved creation intent per runtime, shared across wallet route remounts.                                           |
| Observation tickets   | Per-payment/read sequence to reject older in-session results.                                                                      |
| Disposal              | Synchronously invalidate runtime, detach listeners, abort observers, clear drafts/intents, cancel and remove wallet-scope queries. |

Do not depend on Auth's account-query cleanup to remove Wallet queries. Do not clear unrelated features' caches. Session cleanup hides A's data immediately; an aborted server request can still commit, so a later A session requires backend recovery rather than retaining A's private state under B.

## 2. CapabilityAvailability and FinancialRead

Capabilities are independent: wallet read, history list, history detail, methods/quote, creation, payment read/recovery and optional reference context. Availability is set by confirmed application integration/configuration, not by a hardcoded optimistic flag or a probe to a guessed endpoint.

| Read state         | Required presentation                                                       | Permitted actions                                                                              |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Unavailable        | Capability not integrated/configured; no invented zero/empty/sample content | Safe Back; retry only when there is a configured read to retry.                                |
| Initial loading    | No confirmed data yet                                                       | Loading text; prevent duplicate read action.                                                   |
| Ready              | Current owner projection; zero/empty allowed only after confirmed read      | Applicable navigation/refresh.                                                                 |
| Refreshing         | Same-owner last confirmed data marked as updating/stale                     | Preserve content; dedupe concurrent refresh; no financial action based on unconfirmed changes. |
| Refresh error      | Same-owner last confirmed projection plus separate retry notice             | Read retry; never substitute a fixture.                                                        |
| Initial error      | No projection plus safe error/retry                                         | Read retry if configured.                                                                      |
| Denied / not found | Evict that projection and do not show stale private detail                  | Safe return; only contract-permitted recheck.                                                  |
| Session ended      | No financial data or actions                                                | Existing authentication flow.                                                                  |

These are local display states, not payment or ledger statuses. A disabled query with no data is unavailable/prerequisite-waiting, not automatically loading or empty. A later transport error must not restore a projection already denied by a 403/404 observation.

## 3. WalletSnapshot

- Owner scope is supplied by the authenticated runtime. Actual wallet/history responses have no owner field; guard captured owner/generation before and after each request rather than require an invented `ownerId`.
- Actual wallet fields are `availableCredit`, `heldCredit` (nonnegative two-decimal Credit strings), and `walletVersion` (number). No universal divide-by-100 conversion.
- `walletVersion` is supplied, but no server as-of timestamp exists in the projection. A local received-at time is observation metadata only and must be labeled separately if displayed.
- Purchased/bonus breakdown is not returned; no invented breakdown or withdrawal bucket.
- Home consumes the same projection/key as wallet; it does not own another sample balance or a balance calculated from history.
- A successful owner wallet read with no physical wallet returns virtual `0.00`/`0.00`, version `0`; it neither creates a physical wallet nor grants bonus. A failed/disabled read never becomes virtual zero. This known backend behavior is distinct from an empty history response and from mobile availability.

## 4. TopUpDraft and immutable PaymentIntent

| Concept                    | Draft                                                  | After explicit confirmation                                                                                    |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Amount/method              | Editable local input with retained validation messages | Frozen canonical submitted snapshot; edits cannot silently mutate an unresolved intent.                        |
| Estimated/confirmed Credit | Clearly marked estimate or backend quote               | Preserve exactly what was reviewed and the authoritative response, including any mismatch requiring re-review. |
| Intent identity            | None until the user confirms                           | One local intent identity; server key/correlation follows GAP-06, never inferred from matching amount/body.    |
| Lock                       | No request                                             | Runtime claims synchronously before the first await, independent of screen pending rendering.                  |
| Payment identity           | None                                                   | Store only a confirmed, contract-validated identity associated with this intent/current owner.                 |
| Outcome                    | No creation attempted                                  | Separate local creation result and later backend payment observation.                                          |

Local creation lifecycle:

```text
DRAFT -> REVIEW -> CREATING
CREATING -> CREATED_WITH_ID               confirmed valid creation response
CREATING -> REJECTED_WITH_NO_CREATION     only confirmed no-creation semantics
CREATING -> UNKNOWN_OUTCOME              dispatched request with uncertain result
UNKNOWN_OUTCOME -> CREATED_WITH_ID       confirmed reconciliation of same intent
UNKNOWN_OUTCOME -> REJECTED_WITH_NO_CREATION  confirmed reconciliation, no payment
```

No timeout, abort, remount or reconnect transition goes directly from UNKNOWN to a new CREATING intent. Creating a genuinely new intent requires explicit user confirmation after the unresolved one is reconciled. `CREATED_WITH_ID` is not `PAID`; QR preparation/rendering failure is separate UI state and preserves a known payment identity.

The current plan stores these objects only within the active session. Production creation stays gated until GAP-06 defines recovery after app/process termination or lost ID. No durable balance/payment cache, storage format or recovery endpoint is invented here.

Creation resolution means knowing whether/which payment was created, not necessarily a terminal payment status. A known `PENDING` payment is not the same as UNKNOWN_OUTCOME. This design does not invent a universal ban on a later explicitly confirmed intent while another known payment is pending; any such restriction must come from the accepted Product/backend contract.

## 5. PaymentObservation and PaymentReadState

| Concept                | Rule                                                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment identity/owner | Requested identity must match the returned projection and authenticated owner; reject mismatches.                                                                                                                                                     |
| VND/Credit/rate        | Use confirmed snapshot, not route amount. Do not silently reinterpret a changed quote.                                                                                                                                                                |
| Backend state          | `CREATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`, or neutral unknown/unavailable if unfamiliar.                                                                                                                                          |
| Gateway context        | payOS QR-only: verified descriptor fields are `paymentLinkId`, raw-data `qrCode`, string `orderCode`, `providerStatus`. This protocol descriptor is not yet a public owner Payment API projection; no hosted URL, card input or provider credentials. |
| Expiry                 | Approved immutable quote lifetime is 60 minutes in the backend policy. Display only an authoritative expiry field/status when the public contract exists; do not derive EXPIRED or renew TTL from local timers.                                       |
| Observation ordering   | Capture request sequence and session; ignore late superseded responses. Serialize status reads for the same identity when possible.                                                                                                                   |
| Freshness conflict     | Preserve the previous confirmed observation as stale and surface inability to reconcile conflicting snapshots; do not invent a legal transition from enum order or client time. GAP-05 must define server freshness/transition behavior.              |
| Related refresh        | Wallet/history refresh results are separate fields from payment status; `PAID` is not overwritten by refresh failure.                                                                                                                                 |

Statuses are observations, not a transition machine implemented by the client. A later confirmed refund may replace a prior paid observation; the client cannot infer when or how. Closing the QR screen, missing callback and exhausted checking budget are not additional payment states. Descriptor `providerStatus` is not the backend Payment status and cannot establish `PAID`.

No `TOP_UP` row is synthesized from `PAID`; the ledger read supplies its own identity, amount and status. No success query parameter is admitted to this model.

### QR presentation state (payment-stage gated)

Model QR preparation/unavailable, ready and local rendering error independently from payment outcome. Encode the exact raw `qrCode` text locally into a matrix and render with the existing native/web SVG renderer; it is neither an image URI nor SVG/XML markup. Never open it with Linking/WebView, send it to a remote QR service, normalize its content, log it or write it to a real-account cache in preview mode.

No QR encoder is currently declared/installed. Encoder/renderer choice, SDK/web compatibility and independent decode-to-exact-payload checks are explicit payment-stage implementation gates; planning installs nothing. Preserve known payment/status access if rendering fails. The QR flow requires no return/cancel screen or hosted-checkout navigation; server-only HTTPS return/cancel configuration does not change that. Saving/sharing QR or opening a bank app is not implicitly added.

## 6. CreditTransaction and FinancialReference

The actual owner ledger projection supplies `id`, `operationId`, `type`, nonnegative magnitude `amount`, signed `availableDelta`/`heldDelta`, `availableAfter`/`heldAfter`, `status`, `referenceType`, `referenceId`, nullable `reversesTransactionId` and `createdAt`. All five Credit fields are two-decimal strings, already in Credit. Display separate Available/Held effects; do not derive a universal signed movement from magnitude. No fixture `description`, combined `reference` or `after` field is assumed. An operation/reference/reversal identifier is context, not permission to navigate.

Known ledger states: `PENDING`, `SUCCESS`, `FAILED`, `REVERSED`; actual enum/projection evidence is recorded in [wallet-http.md](contracts/wallet-http.md). Unknown state/type is displayed neutrally, never relabeled success/failure or assigned a guessed sign. Detail is an owner-only UUID read; missing/nonowner records return `404 CREDIT_TRANSACTION_NOT_FOUND` and must not be revived from a stale cached list preview.

| Entry/context                       | Interpretation constraint                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| HOLD / RELEASE                      | Distinguish movement between Available/Held from loss/earning; display supplied effects.                                                          |
| PATH_RETURN                         | TWO_WAY return to original holder; no inference of another user's earning.                                                                        |
| TEACHING_PAYMENT / TEACHING_EARNING | ONE_WAY payer/teacher movements, separate from a fee; no per-Session settlement calculation.                                                      |
| PLATFORM_FEE                        | Separate recorded effect; do not subtract its display amount twice.                                                                               |
| REFUND / REVERSED / ADJUSTMENT      | Preserve original entry and supplied linkage/effects. No inferred cash payout, partial-refund semantics or edit action.                           |
| Material / bonus / penalty          | Preserve distinct type and recorded amounts; do not create or predict these operations.                                                           |
| Related reference                   | Type + ID + optional safe label, and a supported authorized destination only if confirmed. A fixture `path-*` string is not a real path contract. |

No immutable server guarantees are claimed from a read model alone. Append-only/atomic posting must be evidenced by the owning backend acceptance.

## 7. TransactionPage and HistorySelection

- Query identity includes owner, generation, optional `type`/`referenceType` filters and page-chain identity. These are the accepted history filters; no status/date/search filter is sent. Unsupported query properties fail backend validation. Changing filter clears its cursor chain; late old-filter results cannot populate the new one.
- Keep server entry-sequence descending order and identity-based deduplication; do not sort by displayed `createdAt`, amount or UUID. Private entry sequence never needs to be exposed or reconstructed.
- Explicitly request mobile `limit=20` for every page. Backend permits 1..100/default 20; the shared mobile page parser accepts only up to 50. The chosen supported subset reuses the existing parser without changing shared behavior. Envelope is `data` plus `meta.pagination.{limit,hasMore,nextCursor}`; validate ledger items in the wallet adapter.
- Opaque signed cursors bind owner, type/referenceType and the first-page high-water sequence; preserve the exact token. Continuations include only entries at/below that watermark and below the prior page boundary. Never decode/build cursors or reuse them across filters/owners.
- Later-page failure preserves earlier confirmed pages; retry repeats that read/cursor. `400 INVALID_LEDGER_CURSOR` offers explicit restart from no cursor; retain truthful stale content, do not loop or silently mix snapshots.
- Refresh/new-entry discovery starts a new page-one snapshot and rebuilds continuation cursors. Never append old-watermark continuations to a refreshed first page. New appends are intentionally absent from the old snapshot; deduplication alone cannot repair mixed chains.
- Detail access denial evicts the detail; it also prevents a cached list preview from leaking that denied detail. A later list refresh follows its own authorization contract.
- Never sum entries/pages into current balances or manufacture a missing pending-payment row.
