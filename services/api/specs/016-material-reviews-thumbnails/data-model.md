# Data Model: Material Reviews and Thumbnails

## MaterialReview

| Field               | Type                    | Notes                               |
| ------------------- | ----------------------- | ----------------------------------- |
| id                  | UUID                    | Primary key                         |
| materialId          | UUID                    | FK Material, restrict delete        |
| authorId            | UUID                    | FK User, restrict delete            |
| rating              | smallint                | CHECK 1..5                          |
| comment             | varchar(2000), nullable | normalized, blank becomes null      |
| status              | enum/text               | `VISIBLE`, `HIDDEN`                 |
| eligibilitySource   | text                    | `FREE_ACCESS` or `PAID_ENTITLEMENT` |
| sourceOrderId       | UUID, nullable          | private trace only; never public    |
| version             | int                     | optimistic concurrency, starts 1    |
| createdAt/updatedAt | timestamptz             | UTC                                 |
| deletedAt           | timestamptz, nullable   | soft delete                         |

Indexes/constraints:

- partial unique `(material_id, author_id) WHERE deleted_at IS NULL`
- public page `(material_id, status, created_at DESC, review_id DESC) WHERE deleted_at IS NULL`
- CHECK rating 1–5; version > 0

`verifiedPurchase` is not stored. Public reads derive it from the author's current
ACTIVE purchase entitlement for the material, so refund and repurchase are reflected
without mutating review history.

## MaterialRatingSummary

One row per material: `visibleCount`, `star1`..`star5`, `ratingSum`, `updatedAt`.
Average is `ratingSum / visibleCount` at the API boundary; do not store floating point.
All counters are non-negative and `visibleCount = star1+...+star5`.

The service updates counters transactionally using old/new review state. A repair script
recomputes from authoritative review rows and reports drift before changing a row.

## MaterialReviewReport

`id`, `reviewId`, `reporterId`, `reasonCode`, `description`, `status`, assignee/decision
metadata, and UTC timestamps. Use one active report per reporter/review. This table is
separate from `ReportCase.relatedMaterialId`, so material-content and review-text reports
cannot be confused.

## MaterialThumbnail

| Field                           | Type        | Notes                                      |
| ------------------------------- | ----------- | ------------------------------------------ |
| id                              | UUID        | Primary key                                |
| materialId                      | UUID        | FK Material                                |
| sourceFileId                    | UUID        | CLEAN cover upload                         |
| sourceGeneration                | int         | stale-job protection                       |
| status                          | text        | `PENDING`, `READY`, `FAILED`, `SUPERSEDED` |
| smallObjectKey/largeObjectKey   | text        | private infrastructure fields              |
| width/height/mime/size/checksum | scalar      | derivative metadata                        |
| attempts/failureCode            | scalar      | bounded retry/diagnosis                    |
| createdAt/updatedAt             | timestamptz | UTC                                        |

Only one non-superseded thumbnail generation may be current per material. Output object
keys derive from material ID + source generation + variant, making retries idempotent.

## MaterialDownloadGrant

| Field               | Type                  | Notes                                                  |
| ------------------- | --------------------- | ------------------------------------------------------ |
| id                  | UUID                  | One signing attempt                                    |
| materialId          | UUID                  | FK Material                                            |
| orderId             | UUID, nullable        | FK MaterialOrder; required only for `PAID_ENTITLEMENT` |
| accessSource        | text                  | `FREE_PUBLIC` or `PAID_ENTITLEMENT`                    |
| requestedBy         | UUID                  | Must be the order buyer                                |
| status              | text                  | `PENDING`, `ISSUED`, `FAILED`, `EXPIRED`               |
| expiresAt           | timestamptz           | At least the possible signed URL expiry                |
| issuedAt/failedAt   | timestamptz, nullable | DB time                                                |
| failureCode         | text, nullable        | Safe diagnostic code                                   |
| createdAt/updatedAt | timestamptz           | UTC                                                    |

Indexes: `(orderId, status, expiresAt)` for refund checks,
`(materialId, requestedBy, status)` for FREE review eligibility, and
`(status, expiresAt)` for recovery. The URL and object key are not stored. A request
changes only its own grant.
`MaterialOrder.consumedAt` remains the monotonic first-success projection and is never
cleared. The grant table is authoritative evidence for in-flight and issued attempts.

## Entitlement reactivation

The existing unique `(userId, materialId)` row is the current entitlement identity.
Repurchase updates a REVOKED row to ACTIVE, replaces `sourceOrderId` with the new order,
sets a new `grantedAt`, and clears revoke fields. Historical orders and ledger entries
remain immutable; no second entitlement row is inserted.
