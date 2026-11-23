# Implementation Plan: Voucher Redemption

## Module layout — `src/modules/rewards`

```
application/
  ports/voucher-provider.ts          # abstract VoucherProvider
  contracts/voucher-provider.ts      # ProviderBrand, ProviderProduct, IssueInput, IssueResult, ProviderError
  services/reward-catalog.service.ts # read catalog, admin pricing/activation
  services/catalog-sync.service.ts   # upsert brands/products from provider
  services/redemption.service.ts     # redeem, finalize, refund
  services/redemption-reconciler.ts  # resolve ISSUING by clientRef
  services/voucher-secret.cipher.ts  # AES-256-GCM
domain/
  redemption.policy.ts               # state machine, eligibility, limits
infrastructure/
  providers/mock-voucher.provider.ts
  providers/mock-catalog.ts          # fictional scenario brands + reward-catalog.json
  providers/data/reward-catalog.json # real brands/products for demo
  jobs/redemption-reconcile.worker.ts
  jobs/catalog-sync.worker.ts
presentation/http/
  rewards.controller.ts              # /rewards/*
  admin-rewards.controller.ts        # /admin/rewards/*
  *.dto.ts, *.responses.ts
rewards.module.ts
```

Credit module gains `CreditOperationsService.redeemVoucher()` and
`refundVoucher()`, following `purchaseMaterial()`/`refundMaterial()`: lock wallet,
spend lots of any source oldest first, write operation + ledger, return operation ID and
consumed lots (stored in `voucher_redemption_lots`; refund restores those lots).

## Provider port

```ts
abstract class VoucherProvider {
  abstract readonly name: "mock" | "gotit";
  abstract listBrands(locale): Promise<ProviderBrand[]>;
  abstract listProducts(locale): Promise<ProviderProduct[]>;
  abstract issue(input: {
    clientRef;
    providerProductId;
    faceValueVnd;
  }): Promise<IssueResult>;
  abstract findByClientRef(clientRef): Promise<IssueResult | null>;
}
// issue/find throw ProviderError { kind: "DEFINITIVE" | "UNKNOWN", code }
```

## Redemption flow

1. `POST /rewards/redemptions` → guard flag + permission.
2. Tx1 via `IdempotencyService`: lock product, check active + `priceVersion`, check
   user daily limit and platform budget, `redeemVoucher()` debit, insert redemption
   `ISSUING` with `nextCheckAt = now + 1m`, audit.
3. Outside tx: `provider.issue(clientRef = redemption.id)` with 10s timeout.
4. Tx2 finalize:
   - success → encrypt + insert `IssuedVoucher`, `ISSUED`, notification;
   - `DEFINITIVE` → `refundVoucher()`, `FAILED_REFUNDED`, notification;
   - `UNKNOWN`/crash → stays `ISSUING`; response 202 with status.
5. Reconcile worker (BullMQ repeatable, every minute): rows `ISSUING` with
   `nextCheckAt <= now`, `FOR UPDATE SKIP LOCKED`; `findByClientRef` → finalize;
   not found and provider says definitive → refund; else backoff; attempts ≥ max →
   `MANUAL_REVIEW` + admin notification.

Finalize is idempotent: it only transitions from `ISSUING`.

## HTTP contract

| Method | Path                                     | Notes                                                                                 |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/rewards/products`                      | active + priced; filters brand, category; locale                                      |
| GET    | `/rewards/products/:id`                  |                                                                                       |
| POST   | `/rewards/redemptions`                   | `Idempotency-Key`; body `{productId, expectedPriceVersion}`; 201 ISSUED / 202 ISSUING |
| POST   | `/rewards/redemptions/lookup`            | `Idempotency-Key`; own; 200 redemption made with that key, or 404 (key retired)       |
| GET    | `/rewards/redemptions`                   | own, cursor                                                                           |
| GET    | `/rewards/redemptions/:id`               | own; includes decrypted secret when ISSUED; audited                                   |
| GET    | `/admin/rewards/products`                | all statuses                                                                          |
| PATCH  | `/admin/rewards/products/:id`            | price, status, sort, overrides; reason; bumps priceVersion on price change            |
| POST   | `/admin/rewards/catalog/sync`            | enqueue sync                                                                          |
| GET    | `/admin/rewards/redemptions`             | filters                                                                               |
| POST   | `/admin/rewards/redemptions/:id/resolve` | `{action: "ISSUED" \| "REFUND", reason, voucher?}` only from MANUAL_REVIEW            |
| GET    | `/admin/rewards/budget`                  | today's issued face value vs budget                                                   |

Error codes: `VOUCHER_REDEMPTION_DISABLED`, `REWARD_NOT_AVAILABLE`,
`REWARD_PRICE_CHANGED`, `INSUFFICIENT_AVAILABLE_CREDIT`, `VOUCHER_USER_LIMIT_EXCEEDED`,
`VOUCHER_BUDGET_EXCEEDED`, `IDEMPOTENCY_KEY_REUSED`.

Uncertain redeem outcome (client lost the response, or closed after storing the key):

- Resend `POST /rewards/redemptions` with the same key and the same body. A committed request
  replays its redemption; otherwise the request runs now, and a rejection (e.g.
  `REWARD_PRICE_CHANGED`) means nothing was debited.
- Or call `POST /rewards/redemptions/lookup` with the key. It waits for a request still
  running with that key. 404 retires the key: a delayed request with it gets
  `IDEMPOTENCY_KEY_REUSED` and never debits, so the client may start over with a new key.
- Never reuse a key with a different body; that returns `IDEMPOTENCY_KEY_REUSED` without the
  redemption ID.

Admin resolve locks the redemption, changes its state (voucher or refund) and appends
`VOUCHER_RESOLVE` in one transaction; a failed audit leaves it in `MANUAL_REVIEW`.

Permissions: `reward:redeem` (USER), `reward:manage` (STAFF/ADMIN), added to the
RBAC catalog and audit action catalog.

## Mock provider

Two catalogs. Fictional brands (Demo Coffee, Demo Ride, Demo Mart, Demo Books) carry the
failure scenarios. `infrastructure/providers/data/reward-catalog.json` holds 17 categories,
49 real brands and 113 `-ok` products read from gotit.vn. `pnpm db:seed-rewards` loads both
like an admin sync, so a later sync removes nothing. Scenario chosen by `providerProductId`
suffix:

| Suffix     | Behaviour                                                             |
| ---------- | --------------------------------------------------------------------- |
| `-ok`      | issue succeeds                                                        |
| `-oos`     | DEFINITIVE `OUT_OF_STOCK`                                             |
| `-err`     | DEFINITIVE `PROVIDER_REJECTED`                                        |
| `-timeout` | first `issue` throws UNKNOWN; `findByClientRef` later returns success |
| `-lost`    | always UNKNOWN; `findByClientRef` returns null → MANUAL_REVIEW        |
| `-slow`    | 3s delay then success                                                 |

Mock state lives in Redis (keyed by clientRef) so reconcile works across restarts.
Codes: `DEMO-XXXX-XXXX`, marker text from policies.md.

## Risks

- Debit committed but process dies before issue → reconcile finds no provider record.
  For mock, `findByClientRef` null + attempts exhausted → MANUAL_REVIEW (no silent refund).
  For Got It, confirm whether "not found by transactionRefId" is definitive (Q8).
- Encryption key loss makes vouchers unreadable → key in secret store, versioned.

## Checks

`pnpm --filter api lint`, `check-types`, `build`, focused unit + integration tests,
Prisma migration from generated schema.
