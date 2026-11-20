# Voucher Redemption — Data Model

New models live in `prisma/voucher-support.prisma`, appended by
`scripts/generate-runtime-schema.mjs` like `report-support.prisma`. Do not edit
`schema.prisma` directly. Credit amounts use BigInt, 100 units = 1 Credit.

## Enum additions (generator overlay)

- `CreditTransactionType`: `VOUCHER_REDEMPTION`
- `CreditReferenceType`: `VOUCHER_REDEMPTION`
- New `VoucherRedemptionStatus`: `ISSUING`, `ISSUED`, `FAILED_REFUNDED`, `MANUAL_REVIEW`, `REFUNDED_MANUAL`
- New `RewardItemStatus`: `ACTIVE`, `INACTIVE`, `REMOVED`

## RewardBrand — `reward_brands`

| Field           | Type             | Notes                |
| --------------- | ---------------- | -------------------- |
| id              | uuid PK          |                      |
| provider        | varchar(30)      | `mock`, `gotit`      |
| providerBrandId | varchar(100)     | unique with provider |
| nameVi, nameEn  | varchar(150)     | `nameEn` nullable    |
| logoUrl         | text?            |                      |
| status          | RewardItemStatus |                      |
| syncedAt        | timestamptz      |                      |

## RewardProduct — `reward_products`

| Field                              | Type             | Notes                   |
| ---------------------------------- | ---------------- | ----------------------- |
| id                                 | uuid PK          |                         |
| provider, providerProductId        |                  | unique pair             |
| brandId                            | uuid FK          |                         |
| category                           | varchar(100)?    |                         |
| nameVi, nameEn                     | varchar(200)     |                         |
| imageUrl                           | text?            |                         |
| faceValueVnd                       | bigint           | > 0                     |
| termsVi, termsEn                   | text?            |                         |
| validityDays                       | int?             | after issuance          |
| priceCredit                        | bigint?          | null until admin prices |
| priceVersion                       | int              | +1 on price change      |
| status                             | RewardItemStatus | default INACTIVE        |
| sortOrder                          | int              | default 0               |
| displayNameOverride, imageOverride |                  | nullable                |
| rawPayload                         | jsonb            | last provider response  |
| syncedAt, updatedAt                | timestamptz      |                         |

Check: `status = ACTIVE ⇒ priceCredit > 0`.

## VoucherRedemption — `voucher_redemptions`

| Field                                   | Type                     | Notes                         |
| --------------------------------------- | ------------------------ | ----------------------------- |
| id                                      | uuid PK                  | also the provider `clientRef` |
| userId                                  | uuid FK                  |                               |
| productId                               | uuid FK                  |                               |
| priceCredit, priceVersion, faceValueVnd |                          | frozen at request             |
| provider                                | varchar(30)              |                               |
| status                                  | VoucherRedemptionStatus  |                               |
| idempotencyKey                          | varchar(255)             | unique (userId, key digest)   |
| debitOperationId                        | uuid FK CreditOperation  |                               |
| refundOperationId                       | uuid? FK CreditOperation |                               |
| providerTransactionRef                  | varchar(255)?            |                               |
| attempts                                | int                      |                               |
| lastErrorCode                           | varchar(100)?            | no secrets                    |
| nextCheckAt                             | timestamptz?             | reconcile schedule            |
| createdAt, updatedAt, resolvedAt        | timestamptz              |                               |

Indexes: `(userId, createdAt desc, id desc)`, `(status, nextCheckAt)`, `(createdAt)` for budget sums.

## IssuedVoucher — `issued_vouchers`

| Field               | Type         | Notes                                                  |
| ------------------- | ------------ | ------------------------------------------------------ |
| redemptionId        | uuid PK/FK   | 1:1                                                    |
| snapshot            | jsonb        | brand name/logo, product name/image, face value, terms |
| secretCiphertext    | bytea        | AES-256-GCM of `{code, pin, link}`                     |
| secretIv, secretTag | bytea        |                                                        |
| keyVersion          | int          | key rotation                                           |
| expiresAt           | timestamptz? |                                                        |
| issuedAt            | timestamptz  |                                                        |

## SystemConfiguration keys

- `VOUCHER_USER_DAILY_LIMIT_CREDIT` (int Credit)
- `VOUCHER_PLATFORM_DAILY_BUDGET_VND` (int VND)
- `VOUCHER_RECONCILE_MAX_ATTEMPTS` (int, default 6)

## Environment

- `VOUCHER_REDEMPTION_ENABLED` (default `false`)
- `VOUCHER_PROVIDER` = `mock` | `gotit`
- `VOUCHER_SECRET_KEY` (32-byte base64), `VOUCHER_SECRET_KEY_VERSION`
- Phase 2: `GOTIT_BASE_URL`, `GOTIT_API_KEY`, `GOTIT_PRIVATE_KEY`, `GOTIT_PUBLIC_KEY`
