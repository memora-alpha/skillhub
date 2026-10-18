# Payment HTTP contract — implemented backend source

**Declared BE update — 2026-10-18:** User supplied [D1 confirmation](d1-backend-confirmation.md), including authenticated GET /payments/creation-policy and reconciliation/pause/channel/unresolved-owner semantics. These are BE-declared changes absent from the local source at4121c3f, not implemented APIs of this checkout. The source-backed wire inventory below still describes the checked-out revision; do not silently add the new route/fields/errors to existing adapters or assume nullability. Verify the actual fix source/migrations and deployment before contract integration. D1 policy is confirmed with limits; full GAP-06 remains open.

**Recovery review supplement — 2026-10-17**: source unchanged. Foundation spec005 R-07 states no automatic TTL deletion; current helper/schema implement no expiry/delete. Retained same-key/body replay exists; missing mapping runs fresh work. Deployment exceptions/restore and total-loss handling remain D1, not a fabricated infinite/numeric horizon. Quote60min and webhook-after-prune tests are distinct. [D1..D4 record](completion-proposal.md) records approved D2/D3/workflow, environment user-reported available and source audits; no wire field/endpoint or live evidence is added.

**Reviewed**: 2026-10-17. Original baseline `17e3ac1`; new Payment implementation `081b3d2`, merged by `f80ef7a`; inspected checkout `4121c3f`.
**Evidence**: source inspection only in this replan. This is neither deployed API verification nor permission to enable mobile Payment. Paths are repository-relative; line anchors refer to this checkout.

## Wiring, ownership and envelope

`services/api/src/app.module.ts:37,87` wires PaymentsModule; `services/api/src/modules/payments/payments.module.ts:21–43` registers controllers, use cases and worker. Prefix/version are supplied by `services/api/src/main.ts`. Let **P** below mean `services/api/src/modules/payments/`.

| Public operation                       | Implemented source                                                               | Request                                                                                     | Response                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| POST `/api/v1/payments`                | P`presentation/http/payments.controller.ts:60–83`                                | Bearer, mandatory `Idempotency-Key`; exactly `{paymentAmountVnd: string, gateway: "PAYOS"}` | 201 fresh / 200 replay; current Payment projection                      |
| GET `/api/v1/payments/:id`             | Same controller:96–105; P`application/use-cases/read-payments.use-case.ts:49–61` | Bearer; UUID payment ID                                                                     | 200 current owner's Payment; missing/nonowner 404 `PAYMENT_NOT_FOUND`   |
| GET `/api/v1/payments`                 | Same controller:84–95; read use case:62–108                                      | Bearer; `limit`, `cursor`, optional `status`                                                | Payment array + pagination                                              |
| POST `/api/v1/payments/webhooks/payos` | Same controller:112–144                                                          | Provider-signed body, no bearer                                                             | Provider acknowledgement `{success:true}`; **never a mobile operation** |

Owner comes from the authenticated principal and current actor authorization, not a body/query owner. Responses have no owner field. Mobile must bind each request, cache and observation to captured owner/session generation and requested ID. No-store headers do not replace client cache cleanup.

Create/detail use `{success:true,message,data}`; list adds `meta.pagination:{limit,hasMore,nextCursor}`. Error envelope is `{success:false,message,statusCode,details?}`. Evidence: `services/api/src/shared/http/response.ts:3–18,45–73`. Do not require a fictional nested `payment`, `scope` or `quote` on the wire.

## Create and confirmed quote

P`presentation/http/payments.dto.ts:16–28` validates canonical positive integer VND text; domain `top-up-policy.ts:5–27` enforces 1,000–2,000,000 VND in steps of 1,000, conversion 1,000 VND/Credit, immutable server quote expiry of 60 minutes. Off-step input is rejected, not rounded.

Only two body fields are accepted. Do not send amount numbers, owner, Credit, policyVersion, expiry, providerStatus or return/cancel URLs. Global validation rejects extra fields. Local review is an **estimate** until create succeeds; there is no standalone public quote/policy endpoint. The successful Payment contains the confirmed amount/Credit/rate/expiry. The server stores policyVersion internally but does not expose quoteId or policyVersion in this response.

P`application/use-cases/create-payment.use-case.ts:28–85` checks provider config and policy, then durably reserves Payment/checkout/quote and idempotency result in a transaction, calls the worker outside that transaction, then reads the current owner projection. Any create response can already be CREATED, PENDING, PAID or another supported state; do not assume every 201 has a QR. A response mismatch with the reviewed amount/currency/rate is a protocol/review problem on the **existing** payment, never permission to create a replacement.

## Actual Payment projection

Source: P`presentation/http/payments.dto.ts:46–69` and P`application/use-cases/read-payments.use-case.ts:14–40`.

| Field                        | Wire value / mobile validation                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                         | UUID; detail must equal requested ID                                                                                      |
| `gateway`                    | String; new create supports PAYOS only. Unfamiliar legacy gateway is neutral/read-only, not a new provider flow           |
| `status`                     | CREATED, PENDING, PAID, FAILED, EXPIRED, REFUNDED, **REVIEW**; unfamiliar future value is neutral, never success          |
| `paymentAmountVnd`           | Exact positive integer string; preserve full value                                                                        |
| `currency`                   | VND for this integration; reject unsupported monetary interpretation                                                      |
| `creditAmount`               | Exact two-decimal Credit string; use existing decimal utilities, never floating-point money                               |
| `conversionRateVndPerCredit` | Numeric metadata (current 1000); validate positive integer and consistency with supported quote; not a money-string field |
| `createdAt`                  | ISO date-time string after JSON serialization                                                                             |
| `expiresAt`, `paidAt`        | Required nullable ISO date-time strings; no invented value                                                                |
| `version`                    | Numeric integer (checkout version, legacy fallback 1); reject invalid/unsafe values in mobile parser                      |
| `checkout`                   | Required null or the descriptor below; null is a valid projection, not a failure or permission to create again            |

Non-null checkout fields: `providerStatus:"PENDING"`, `paymentLinkId:string`, `orderCode:digit string`, `qrCode:raw string`. Keep orderCode as text. Preserve QR text exactly; no trim, URL/image/XML interpretation, remote encoder, provider request, logging or credential use on mobile. A server descriptor is not QR-01 renderer acceptance.

## Freshness, QR suppression and observation rules

The server returns checkout only if Payment is PENDING, checkout is READY, expiry is later than **server now**, and raw QR exists (read use case:15–19,31–39).

- Same payment, higher version: accept the authoritative projection after identity/immutable quote validation. Lower version: discard. Do not compare versions between payments or against walletVersion.
- **Equal version is not whole-response equality**: QR can become null as server read-time expiry passes, without a persisted version increment. A same-version response with checkout null suppresses the old QR; do not restore QR from a late equal/lower-version response. This local safety latch is cleared only by a valid newer owner projection, not a timer.
- Conflicting same-version status or immutable quote remains stale/protocol error; keep Check again and do not invent an enum rank. Request tickets still reject obsolete responses.
- EXPIRED → PAID can be valid at a newer version after delayed signed evidence whose transaction time precedes expiry (P`application/services/payment-receipts.service.ts:233–261`). Do not hard-code terminal states as permanently immutable.
- REVIEW means “Cần kiểm tra/đối soát”, not FAILED/no-creation. Public DTO supplies no review reason or admin resolution action.
- `providerStatus`, QR null/visibility, redirect/URL claims, foreground/closure and mobile time never establish Payment outcome. PAID and failed wallet/history refresh are separate results.
- No mobile polling/SSE schedule is selected. Backend worker cadence is not a client interval. Existing server events are optional hints for later owner GET; SSE version is text, HTTP version is numeric.

## Pagination and filter compatibility

P`presentation/http/payments.dto.ts:29–45` accepts limit1..100/default20, cursor length1..1024, optional Payment `status`. Mobile must send **limit=20 on every page**, using the existing parser max50 unchanged.

P`application/use-cases/read-payments.use-case.ts:62–108` sorts descending checkout orderCode. Signed opaque cursor binds owner/status/watermark/before, with a distinct payment signing scope in PaymentsModule. Do not decode, synthesize, timestamp-sort or reuse a ledger cursor. Refresh/status-filter change starts a new cursor-free chain; dedupe by Payment ID. Invalid cursor follows shared `INVALID_LEDGER_CURSOR` handling despite this being a Payment list.

Watermark excludes later order appends, **not subsequent status updates**: page membership can change under a status filter. Do not promise an immutable status snapshot or infer a missing payment did not exist. This is an owner payment-discovery capability, not a unified ledger; history continues to use type/referenceType only. A user may explicitly select an owner result and re-read its ID; never auto-match a lost intent by amount/time/status.

The list queries checkout rows, so it is not a guaranteed inventory of legacy Payments without checkout. Absence from a list is never proof that an unresolved create did not commit.

## Idempotency, errors and recovery limits

Evidence: `services/api/src/infrastructure/idempotency/idempotency.service.ts:80–134`; P create use case:28–85; `services/api/prisma/runtime-support.prisma:114–125`.

- Visible ASCII key length1..128; backend scopes digest by owner + operation `payment:create`, fingerprints canonical JSON body and stores resource reference atomically. Same retained key/body reuses the same ID; changed body gives409. Replay returns **current** detail, not byte-identical original data, and does not renew persisted quote TTL.
- Generic service can report incomplete/unavailable record as503. No retention/pruning SLA or GET-by-key endpoint is implemented/documented. Multiple distinct-key pending payments are supported.
- Known ID: use owner GET, which remains readable when provider creation is disabled. Unknown result with retained key/body: only explicitly authorized same-intent replay under an accepted retention/recovery policy; no automatic renewal/reconnect/foreground replay.
- Lost key/body/ID across process death: owner list supports discovery, not definitive intent correlation. Durable mobile correlation/security/logout/retention policy remains unapproved. Memory remount is not restart recovery. See [payment-recovery.md](payment-recovery.md).
- Create must use the shared client with `replayAfterRenewal:false`, signal and mutation retry disabled; preserve a dispatched unknown result on timeout/abort/protocol failure.

| Observed error                                                             | Source-backed meaning / mobile action                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid body/key / unsupported policy                                      | Validation/preflight rejection for that request; correct only when no earlier dispatch is unresolved                                               |
| 404 PAYMENT_NOT_FOUND on owner detail                                      | No accessible record; evict private projection and show safe Back, not “unpaid”                                                                    |
| 409 idempotency body conflict                                              | Do not change key/body to bypass the unresolved intent                                                                                             |
| 409 CREDIT_PROVENANCE_REVIEW_REQUIRED / CREDIT_PROVENANCE_BALANCE_MISMATCH | Wallet provenance eligibility blocked before new reservation; explain blocked top-up, preserve existing intent, no client repair                   |
| 503 PAYMENT_PROVIDER_UNAVAILABLE                                           | Config disabled check occurs **before** replay lookup; an earlier committed payment can still exist. Prefer known-ID GET; do not infer no creation |
| 401/403/429, transport error, generic409/5xx                               | Follow auth/denial handling; not blanket proof that an earlier attempt never committed                                                             |

Provenance evidence: `services/api/src/modules/credit/application/services/credit-operations.service.ts:10–28`, `credit-provenance.service.ts:8–44`; migration `services/api/prisma/migrations/20261017000000_payos_payments/migration.sql:3–7` auto-tracks only empty legacy wallets. Eligibility/deployment data is a backend-owned acceptance prerequisite.

Some idempotency errors use plain English message text rather than a dedicated uppercase business code. The shared mobile error parser does not turn that into a new confirmed code; do not invent one or classify every409 as a proven no-creation rejection. Test safe generic handling as well as actual named provenance codes.

## Backend posting and remaining design-only capabilities

P`application/services/payment-receipts.service.ts:62–172,233–289` verifies signatures/channel/immutable quote, deduplicates receipts, and commits PAID, one TOP_UP, wallet/lot update, audit and events atomically. `credit-operations.service.ts:31–109` uses permanent domain identity `payment-top-up:{paymentId}`. Worker persisted leases/reconciliation are implemented in P`application/services/payment-checkout.worker.ts:25–114,137–293`; ambiguous missing QR can enter REVIEW rather than recreate.

These are implemented source, not evidence of an enabled merchant deployment. Backend spec009 validation reports mocked-provider PostgreSQL/HTTP tests; no real payOS/native run is claimed here. Feature config defaults disabled; channel credentials, migrations/grants, operational recovery and independent merchant sequence safety require backend-owner evidence (`services/api/docs/payos-qr-payments.vi.md:144–163`).

No public standalone quote/policy, client reconcile/cancel/refund/mark-paid, or GET-by-idempotency-key operation exists. Spec009 administration/other Credit mutations remain design-only unless their actual source is separately established; this mobile feature introduces none.
