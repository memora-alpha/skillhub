# Payment HTTP contract — backend 7fc0f83

**Ordinary integration — 2026-10-18:** The existing contract is now connected to ordinary native top-up/Payment routes and independent native/web owner status reads. [Current integration](normal-payment-integration.md) supersedes prior flags-off notes; wire contract unchanged, web create unavailable. Activation is source behavior, not actual API/payOS/native acceptance.

**Implementation checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Test-first eligible source batch is implemented. T043/T052/T076/T078..T088/T094 complete within DOC/L/C/W/source-check criteria;100 IDs,83 checked/17 unchecked, original68 completed task bodies preserved. Normal Payment/status/create/recovery/Confirm flags remain off. Private native QA read/financial entries are source-ready, not an activated or accepted deployment. Current fields, cleanup/store/claim/create/replay/QR/status replace earlier pending-source proposals below. D1/D2/D3/D4 are not reopened. Actual API/payOS/Android/iOS acceptance and full T100 stay gated; historical results keep their original scope.

Reviewed2026-10-18 at HEAD5101aea, Payment hardening7fc0f83; prior081b3d2 and original17e3ac1. This replaces the previous source-missing contract. Source-only evidence, no deployed/API/payment execution. See [audit](backend-review-7fc0f83.md), [recovery](payment-recovery.md) and [gates](integration-gates.md).

Let P = `services/api/src/modules/payments/`. Paths and anchors refer to the inspected source. No Payment capability is enabled.

## Wiring, ownership and envelope

| Endpoint                               | Authentication / request                                                                     | Response / source                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/v1/payments`                | Current bearer owner; Idempotency-Key; exactly `{paymentAmountVnd:"100000",gateway:"PAYOS"}` | 201 fresh /200 retained or reconstructed replay; current Payment DTO. P`presentation/http/payments.controller.ts:63–85`, `payments.dto.ts:16–28`. |
| GET `/api/v1/payments/creation-policy` | Current bearer owner; no query/body                                                          | Success data CreationPolicy. Controller:98–105, DTO:82–105.                                                                                       |
| GET `/api/v1/payments`                 | Current bearer owner; limit20, optional status and opaque cursor                             | Payment array + pagination; controller:86–96, P`application/use-cases/read-payments.use-case.ts:101–151`.                                         |
| GET `/api/v1/payments/:id`             | Current bearer owner and UUID path                                                           | Own Payment or404; controller:106–113, same use case:82–100.                                                                                      |
| POST `/api/v1/payments/webhooks/payos` | Provider-signed callback; never mobile                                                       | Provider acknowledgement; signed verification/posting remains backend-owned.                                                                      |

All public owner routes use IdentityGuard and no-store. Owner comes from authenticated principal, never request ownerId; DTO has no owner field. Bind mobile request/cache/ticket/result to owner/session generation and requested ID.

Success envelope is `{success:true,message,data}`; lists add `meta.pagination:{limit,hasMore,nextCursor}`. Errors use `{success:false,message,statusCode,details?}` (`services/api/src/shared/http/response.ts:3–18,38–79`). For PAYMENT_UNRESOLVED/PAYMENT_RECONCILIATION_REQUIRED409, an allowed own UUID is at `details.existingPaymentId`, not data or a top-level ID (`http-exception.filter.ts:83–95`). Global operational blocks never expose another owner's ID.

## Creation-policy snapshot

Required fields (P`presentation/http/payments.dto.ts:82–105`):

| Field             | Actual contract                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| canCreate         | Boolean.                                                                      |
| reasonCode        | String or null; known codes below.                                            |
| existingPaymentId | Own blocking UUID or null; global/provider/pause/channel decisions have null. |

Policy priority (`application/services/payment-creation-policy.ts:24–66`): provider disabled → PAYMENT_PROVIDER_UNAVAILABLE; pause → PAYMENT_CREATION_PAUSED; any owner's old-channel CREATED/PENDING/REVIEW → PAYMENT_CHANNEL_RECONCILIATION_REQUIRED; own oldest unresolved or legacy PAYOS identity-less Payment → PAYMENT_UNRESOLVED or PAYMENT_RECONCILIATION_REQUIRED with own ID; otherwise true/null/null. Legacy missing identity blocks even PAID. Own-ID blocks cause POST409; global/provider/pause/channel blocks503.

GET has no version, as-of, validity duration or reservation token. It is not the amount/quote API. POST rechecks fresh eligibility under the current owner lock; canCreate=true never authorizes bypass of an existing local unknown outcome. Treat unknown/inconsistent policy safely as creation unavailable; preserve a valid supplied owner ID only through authenticated owner reads. No client availability TTL or background mutation queue.

## Create and confirmed quote

Two-field body only. Canonical VND integer text; policy1000..2000000 inclusive, step1000, conversion1000 VND/Credit and server quote60min (`domain/top-up-policy.ts:5–34`). No rounding, float money, owner/Credit/policyVersion/expiry/URLs in request. There is no standalone quote API; review is an estimate until the backend returns confirmed amount/Credit/rate/expiry. Stored policyVersion is internal, not a DTO field.

Order is material (`application/use-cases/create-payment.use-case.ts:39–131`): provider enabled + current amount validation before any replay; authorize/live actor lock; retained HTTP mapping replay, or surviving owner/key Payment identity fallback; **only fresh** work checks policy and reserves Payment/checkout/quote in the idempotency transaction. Worker provider work runs after commit; then return the current owner read. Missing Payment behind retained mapping becomes409 reconciliation. Reconstructed replay returns200 and preserves orderCode/expiry. No assumption that201 has PENDING or a usable QR.

PAYMENT_CREATION_PAUSED with enabled provider still permits valid same-identity replay. PAYMENTS_ENABLED=false blocks all POST before replay. Any401/409/429/503/timeout after an earlier ambiguous attempt is not proof of no creation. Use the same owner/key/body; never new-key retry or quote renewal. Shared mobile HTTP must use AbortSignal, replayAfterRenewal:false, no mutation retry/reconnect/foreground replay.

## Actual Payment projection

P`presentation/http/payments.dto.ts:46–79`, `application/use-cases/read-payments.use-case.ts:17–68`.

| Required field             | Wire validation                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                         | UUID, exactly requested detail ID.                                                                                                                                                                                                  |
| gateway                    | String; new create PAYOS; unknown legacy gateway is neutral/read-only.                                                                                                                                                              |
| status                     | CREATED/PENDING/PAID/FAILED/EXPIRED/REFUNDED/REVIEW; unknown string remains unconfirmed.                                                                                                                                            |
| paymentAmountVnd           | Exact positive integer string; no float conversion.                                                                                                                                                                                 |
| currency                   | VND.                                                                                                                                                                                                                                |
| creditAmount               | Exact two-decimal Credit string; compare quote with exact arithmetic, never credit locally.                                                                                                                                         |
| conversionRateVndPerCredit | Number1000 for this source; no invented rate/rounding.                                                                                                                                                                              |
| createdAt                  | ISO date-time.                                                                                                                                                                                                                      |
| expiresAt / paidAt         | Each ISO date-time or null; do not omit missing fields into null defaults.                                                                                                                                                          |
| version                    | Positive numeric checkout version, fallback1 when checkout missing. Numeric ordering; no status ranking.                                                                                                                            |
| recoveryRequired           | **New required boolean**; true iff recoveryReason is nonnull in this source.                                                                                                                                                        |
| recoveryReason             | **New required string or null**; PAYMENT_CHECKOUT_MISSING, PAYMENT_REVIEW_REQUIRED, PAYMENT_CHANNEL_UNAVAILABLE currently. Unknown reason is safely read-only/support context, never permission to create or infer payment failure. |
| checkout                   | null or exact `{providerStatus:"PENDING",paymentLinkId,orderCode,qrCode}`; IDs/raw QR strings, orderCode exact decimal text. Provider status is not verified Payment outcome.                                                       |

Recovery precedence: missing checkout, then REVIEW, then enabled + foreign-channel CREATED/PENDING; else null. Pause/preparation/expiry/provider-disabled may return checkout:null with recoveryRequired:false. Do not derive one from the other. PAID plus missing-checkout recovery remains PAID and separately requires support/read context.

## Freshness, QR suppression and observation rules

Show QR only for enabled/not-paused/current-channel, no recovery reason, Payment PENDING, checkout READY, future server expiry and raw QR present (read use case:38–47). Operational config and server time can hide QR **without version increment**.

Preserve existing request tickets, owner/session checks and numeric version ordering. Immutable identity/quote conflicts stay stale. At the same version, current read-time recovery fields may change or clear; project them without treating all such changes as impossible financial transitions. Once checkout:null is accepted for that version, old QR must stay suppressed at the same version even after a reason clears. Older tickets/lower versions do not undo it. Metadata never upgrades/downgrades the payment status; newer authoritative EXPIRED→PAID remains valid. No client expiry, status ordering, guessed polling/SSE cadence or client settlement.

Mobile currently drops the new recovery fields; schema/types/reducer/UI fixtures must be corrected before release. Completed source/W tests retain their original scope, not new-contract acceptance.

## Pagination, filters and support discovery

Payment list: limit1..100 BE, mobile20; optional status + cursor, descending immutable orderCode/watermark snapshot, owner/status-bound signed cursor. Existing shared parser max50 is compatible with20; do not widen it. Keep Payment pagination separate from ledger type/referenceType chains. Refresh/filter changes start fresh scoped chains; stale continuations never mix.

List starts from PayosCheckout rows. A legacy Payment without checkout may be absent from every list page while policy reports its own blocking ID. Read that ID through owner detail where supplied. No GET-by-key, amount/time match, list absence or404 is a no-creation/replacement oracle.

Mobile shared AppError drops error details today. Recommended later implementation uses local known ID or explicit policy GET after409, then owner GET; failure/no ID retains unknown/support block. No shared transport expansion is implied by this plan. A future typed details change needs explicit ownership/consumer tests.

## Backend posting and unsupported operations

`application/services/payment-receipts.service.ts:97–171,238–242,264–288` verifies and atomically posts TOP_UP/wallet/ledger/lots/audit/events, closes QR/version; REVIEW does not automatically resolve from a late valid receipt. PAID cannot become REVIEW due to conflicting evidence. Wallet/history refresh failure never changes PAID in mobile; retries repeat reads only.

No mobile reconcile/cancel/refund/cash-out/mark-paid, total-identity reconstruction, owner REVIEW-clearance, QR regeneration or provider lookup endpoint. Read-only operator report/runbook are operations tools, not public recovery APIs. Source presence is separate from deployed migration/channel/native acceptance.
