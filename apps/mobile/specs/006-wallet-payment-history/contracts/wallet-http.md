# Implemented owner wallet/history HTTP contract

**Current recheck**: 2026-10-17 at4121c3f. Wallet/history HTTP source has no contract drift from17e3ac1; Payment081b3d2/f80ef7a is now implemented separately in [payment-http.md](payment-http.md). P1/P2/P3 checkpoints below retain their historical scope and do not describe current Payment backend inventory.

**Original inspected baseline**: 2026-10-16. **Source baseline**: `17e3ac1f38df1b645bd5f103a7111eae00f5e0b4`.
**Classification**: Implemented source contract for mobile adapter design. No endpoint call or runtime test was executed by this planning update. Deployment/migration/target-environment acceptance remains separate. Source paths below are repository-relative.

**P1 checkpoint (2026-10-17)**: Rechecked against the same full SHA above. A synthetic loopback fixture now exists in `apps/mobile/tests/fixtures/wallet-api.ts` for these three GET contracts, exercised only by foundation tests. Its opaque cursor map is a test control, not the backend HMAC implementation. No production mobile adapter/schema/query has been installed; all P1 account capabilities remain disabled. Actual owner API/deployment/migration acceptance is NOT_RUN. See [P1 validation](../validation.md) for exact commands and limits; Payment routes remain proposals as described below.

**P2 checkpoint (2026-10-17)**: No source drift found at that SHA. Mobile now implements only Wallet GET via `src/features/wallet/schemas/wallet-contracts.ts`, `api/wallet-api.ts`, `utils/wallet-query.ts` and `hooks/use-wallet.ts`, consumed by Home/overview. It strips extra fields, rejects malformed Credit/version/missing values, uses no response owner/as-of, and binds reads to owner/generation plus AbortSignal. Only wallet-read is enabled, only on focused consumers. Denial replaces cached money with a denial-only value. List/detail adapters and Payment remain unimplemented. [P2 validation](../validation.md) records L/C/W results; deployed A/migration and NA/NI are still NOT_RUN.

**P3 checkpoint (2026-10-17, supersedes P2 mobile scope)**: List/detail are now implemented by `src/features/wallet/schemas/transaction-contracts.ts`, `api/transaction-api.ts`, `utils/history-query.ts`, `utils/transaction-query.ts` and their hooks/views. Exact source fields, UUID target match, five monetary strings and ISO time are validated; future codes remain neutral. List uses explicit20 and only confirmed filters; cursors are opaque. InfiniteQuery refresh atomically rebuilds all loaded pages from the fresh first page; failures keep the previous snapshot. Local chain incarnation changes on filter/restart, with no backend watermark/TTL invented. Denial evicts cached projections across all owned History filters; detail never borrows cached list data. Shared page parser remains max50. Only the three read capabilities are enabled. [P3 validation](../validation.md) separates48 L/C focused tests and synthetic W from still-NOT_RUN deployed A/G/NA/NI and T053+ checkpoints. No backend or Payment change.

Path shorthand in this document: services/api/src/modules/credit/ and services/api/src/modules/payments/ expand to services/api/src/modules/credit/ and services/api/src/modules/payments/; services/api/src/modules/ expands to services/api/src/modules/; services/api/src/configs/ to services/api/src/configs/; services/api/prisma/ to services/api/prisma/. All line anchors refer to the inspected source above.

## Endpoints and owner boundary

Prefix/versioning is in services/api/src/main.ts:22–34; controller is services/api/src/modules/credit/presentation/http/wallet.controller.ts:26–67.

| Method and absolute API path            | Input                                                     | Result data                            |
| --------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| GET /api/v1/me/wallet                   | Bearer session; no owner/body                             | WalletView                             |
| GET /api/v1/me/wallet/transactions      | Bearer session; limit, optional cursor/type/referenceType | LedgerEntryView[] with meta.pagination |
| GET /api/v1/me/wallet/transactions/{id} | Bearer session; UUID entry ID                             | One LedgerEntryView                    |

Use the configured shared API base URL, without duplicating /api/v1 if already present. Shared client paths are /me/wallet and its transactions children. These GETs require no Idempotency-Key.

IdentityGuard verifies Bearer/session (services/api/src/shared/auth/identity.guard.ts:17–29), with JWT/active-user/revocation/security-version checks in services/api/src/modules/auth/application/services/sessions.service.ts:79–125. Every read use case rechecks live identity through SkillActorService.require (services/api/src/modules/users/application/services/skill-actor.service.ts:56–89); ALL restriction produces 403 SKILL_PERMISSION_REQUIRED. Self reads accept no arbitrary owner ID and require no extra read:any permission. Detail repository predicates both userId and id (services/api/src/modules/credit/infrastructure/persistence/prisma-wallet.repository.ts:74–85); missing and nonowner detail both produce 404 CREDIT_TRANSACTION_NOT_FOUND (services/api/src/modules/credit/application/use-cases/get-credit-transaction.use-case.ts:17–23). Returned business references are context, not related-feature permission.

## Envelopes and exact projection

Backend helpers are services/api/src/shared/http/response.ts:3–18,38–61.

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {
    "availableCredit": "100.00",
    "heldCredit": "20.00",
    "walletVersion": 3
  }
}
```

Wallet data is exactly availableCredit:string, heldCredit:string and walletVersion:number (services/api/src/modules/credit/presentation/http/wallet.responses.ts:13–17). Money is **Credit decimal text with exactly two fractional digits**, already formatted from bigint hundredths. Do not divide again or pass through Number. Missing wallet returns "0.00"/"0.00"/0 without inserting a row/awarding Credit (services/api/src/modules/credit/application/use-cases/get-wallet.use-case.ts:17–26). Only a successful response establishes legitimate zero; error/missing response is never zero.

No ownerId, server timestamp, Purchased/Bonus, held allocation or total is projected. Scope comes from request/session. walletVersion is not a timestamp or a global ledger watermark.

Ledger list/detail projection (services/api/src/modules/credit/presentation/http/wallet.responses.ts:19–35; services/api/src/modules/credit/application/services/ledger-entry.mapper.ts:4–19):

| Field                      | Wire meaning                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------ |
| id, operationId            | UUID strings; internal entrySequence is not exposed                                  |
| type                       | CreditTransactionType below                                                          |
| amount                     | Positive Credit magnitude of the recorded entry; not signed Available movement       |
| availableDelta, heldDelta  | Independent signed two-decimal Credit strings                                        |
| availableAfter, heldAfter  | Independent nonnegative two-decimal post-entry Credit strings                        |
| status                     | CreditTransactionStatus below                                                        |
| referenceType, referenceId | Type plus text ID from the operation, without safe description/destination guarantee |
| reversesTransactionId      | UUID string or null, without inferred reversal amount/reason/join                    |
| createdAt                  | JSON date-time string from stored Date; local formatting must not reorder rows       |

services/api/src/modules/credit/domain/money.ts:16–22 formats signed fractions with bigint magnitude. After foundation migration, SQL requires amount>0 and nonnegative post-balances (services/api/prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql:49–54). Do not impose pure top-up parser/policy bounds on recorded balances/transactions.

Schema codes (services/api/prisma/schema.prisma:174–215):

- Types: TOP_UP, DAILY_BONUS, FEEDBACK_BONUS, HOLD, RELEASE, PATH_RETURN, PLATFORM_FEE, TEACHING_PAYMENT, TEACHING_EARNING, MATERIAL_PURCHASE, MATERIAL_SALE, REFUND, PENALTY, ADJUSTMENT.
- Reference types: PAYMENT, LEARNING_PATH, SESSION, REVIEW, DISPUTE, MATERIAL_ORDER, SYSTEM.
- Ledger states: PENDING, SUCCESS, FAILED, REVERSED. Payment states CREATED/PENDING/PAID/FAILED/EXPIRED/REFUNDED/REVIEW are a different vocabulary.

Enum presence does not prove every operation has a writer. Unknown future codes display neutrally rather than acquire a guessed sign/outcome. HOLD can shift Available to Held; fee/teaching payment may reduce Held with zero Available delta. Do not sum loaded pages into Wallet, subtract a fee twice, synthesize TOP_UP from PAID or infer cash payout from reversal.

## Query/filter and mobile parser compatibility

Source: services/api/src/modules/credit/presentation/http/wallet.dto.ts:17–39; global services/api/src/main.ts:29–34.

| Query         | Implemented behavior                                                 | Mobile decision                                              |
| ------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| limit         | Query text transformed to integer 1..100, default 20                 | Explicitly send 20 on every page                             |
| cursor        | Optional string length 1..1024; signed contents validated separately | Opaque token; URL-encode once, never decode/edit/construct   |
| type          | Optional exact CreditTransactionType                                 | Supported single type filter; omit for all                   |
| referenceType | Optional exact CreditReferenceType                                   | Supported by backend; expose only if required by designed UI |

Filters combine with AND under the authenticated owner. **There is no status/date/direction/owner query field.** Global forbidNonWhitelisted rejects unsupported parameters, including status/userId. Do not implement complete-history status filtering by filtering only loaded pages. Recorded row status remains visible; omit unsupported status filter until actual API extension.

Backend can return limit 100; mobile apps/mobile/src/lib/http/response.ts:35–64 accepts only 1..50. Explicit 20 is compatible without changing shared parser/other consumers. Never request 100 or silently widen shared infrastructure for this feature.

List metadata is exactly {limit:number,hasMore:boolean,nextCursor:string|null} at meta.pagination (services/api/src/modules/credit/application/contracts/wallet.ts:59–62; list-credit-transactions.use-case.ts:41–57). nextCursor is nonnull iff more rows exist; data is an array. Standard message is not a stable localization field.

## Sequence order, watermark, cursor and refresh

1. Cursor-free first page takes owner's lastEntrySequence watermark, or 0 if no wallet (services/api/src/modules/credit/application/use-cases/list-credit-transactions.use-case.ts:19–33).
2. Repository filters user/type/referenceType plus entrySequence<=watermark and, for continuation, entrySequence<before. It returns limit+1 in entrySequence descending order (services/api/src/modules/credit/infrastructure/persistence/prisma-wallet.repository.ts:54–66).
3. Visible rows determine hasMore; cursor retains original watermark and last visible sequence (services/api/src/modules/credit/application/use-cases/list-credit-transactions.use-case.ts:41–57).
4. Base64url body plus HMAC-SHA256 token validates version 1/owner/type/referenceType/positive watermark-before/range with constant-time signature comparison (services/api/src/modules/credit/domain/ledger-cursor.ts:12–67). Signing uses IdentityConfig.jwtKey (services/api/src/modules/credit/credit.module.ts:39–42).

Order is **per-wallet append/commit sequence**, not createdAt descending with an invented ID tie-break. Migration's deterministic legacy backfill uses operation time/IDs/entry number; future inserts get a sequence under the wallet row lock (services/api/prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql:40–64). Appends after first-page watermark cannot enter that chain, even if their displayed timestamp is older.

Token binds owner and both filters; it does not bind limit/session ID, carry TTL or promise survival across signing-key rotation. Signed data is not encrypted. Client still treats it as opaque and scopes cache by owner/generation.

Mobile history key includes owner/generation/type/referenceType and chain identity. Keep server order and defensive ID deduplication without manufacturing cursor progress. Later-page error retains earlier pages. Filter change or explicit refresh starts **without cursor**. After successful new first page replace the old chain; never append old-watermark continuation pages to a refreshed chain. INVALID_LEDGER_CURSOR offers explicit fresh reload, not infinite automatic retry. New entries appear by refresh, not local financial insertion.

Watermark bounds entry membership; it is not a frozen version of joined operation reference fields. Detail is an independently authorized current read without cursor boundary. Do not claim broader immutable snapshot guarantees.

## Read errors and privacy

| Result                                     | Source-backed handling                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| 400 query/UUID validation                  | Safe invalid-input/navigation feedback; never submit invented fields                |
| 400 INVALID_LEDGER_CURSOR                  | Preserve safe existing owner pages; offer fresh cursor-free load                    |
| 401 missing/expired/revoked session        | Existing renewal/session handling; reject late owner/generation results             |
| 403 SKILL_PERMISSION_REQUIRED              | Actor restriction; hide/evict affected private projection                           |
| 404 CREDIT_TRANSACTION_NOT_FOUND           | Missing/nonowner detail; evict detail, safe Back, do not reveal existence           |
| 429/network/server/storage/protocol errors | Shared safe error/connection behavior; retry reads only, never sample/zero fallback |

Error envelope is {success:false,message,statusCode,details?}. Global filter returns safe messages/masks general 5xx (services/api/src/shared/http/http-exception.filter.ts:24–74); mobile accepts shaped uppercase codes rather than arbitrary text (apps/mobile/src/lib/http/response.ts:7–27). No special wallet unavailable code or Payment no-creation guarantee is established by read errors. Wallet controller sets no explicit Cache-Control header; private cache/session lifetime remains mobile responsibility.

## Provider/amount compatibility and remaining Payment gates

Backend spec009 selects payOS **QR-only**. Pure descriptor {paymentLinkId,qrCode,orderCode,providerStatus} follows full response signature/quote verification (services/api/src/modules/payments/application/contracts/payment-gateway.ts:22–28; services/api/src/modules/payments/infrastructure/payos-gateway.ts:138–157). qrCode is data rendered locally, not image/hosted URL. No browser checkout or mobile return/cancel page is required. Required HTTPS return/cancel config remains server-only signed request input (services/api/src/modules/payments/domain/payment-config.ts:10–36; payos-gateway.ts:104–118).

services/api/src/modules/payments/domain/top-up-policy.ts:5–27 implements selected minimum1,000, maximum2,000,000, step1,000 VND, rate1,000 VND/Credit and quote TTL 60m. Create now persists this quote/expiry and returns it through the Payment projection; no standalone quote endpoint exists. Payments defaults disabled; environment validates configuration (services/api/src/configs/environment.ts:2,106).

**Superseded at the new baseline**: PaymentsModule/controller/create/list/detail, provider transport, durable quote/orderCode/receipts, atomic PAID/TOP_UP/wallet/lot posting and worker recovery now exist. [payment-http.md](payment-http.md) provides actual DTO/source evidence; do not reuse former proposed shapes. GAP-06 retention/lost-correlation/mobile restart and QR-01 remain gated. QR/providerStatus/close/timer/redirect never establish success. No Wallet/history payload, filter, pagination or client settlement change follows from these new backend capabilities.

## Migration and reported validation limits

Foundation migration performs atomic preflight of balances/history values, complete zero-origin balances, deterministic compatible history order and Held-allocation totals. It fails rather than guessing opening credits/repairing legacy history. It backfills sequences, installs positive/balance constraints, wallet-lock sequence assignment, transaction UPDATE/DELETE rejection and zero-wallet backfill without bonuses (services/api/prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql:1–73). Target must actually apply this migration and serve matching source before real read acceptance. This mobile task must not apply backend migrations.

Historical17e3ac1 evidence: backend specs/009-credit-payment/validation.md:78–92 reports 86 distinct merge-compatibility cases including isolated real PostgreSQL/HTTP, without changing application data. QR-only tranche at lines 113–118 reports 22 pure/regression cases, no repeated PG run/provider/channel/deployment proof. Full release matrix at lines 124–133 keeps load/legacy coverage, provenance, operational Payment/recovery/provider/deployment pending. These are **reported prior results**, not tests executed now, and separate tranches must not be added together. Future mobile contract fixtures, actual owner-API read/denial/pagination, web and Android/iOS acceptance remain distinct evidence layers.
