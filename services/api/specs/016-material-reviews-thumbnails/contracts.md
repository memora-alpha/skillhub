# HTTP Contracts: Material Reviews and Thumbnails

All paths are under `/api/v1`. Error bodies use the existing SkillHub envelope.

## Public reads

- `GET /materials/:materialId/reviews?limit=20&cursor=...`
  - Returns `{data, pagination, summary}`.
  - Row: `{id, reviewer:{userId,fullName,avatarUrl}, rating, comment,
verifiedPurchase, createdAt, updatedAt}`.
- Existing `GET /materials/:materialId` and `GET /materials` add:
  - `ratingSummary: {average:string|null,total:number,stars:{1..5:number}}`
  - `thumbnail: {smallUrl,largeUrl,expiresAt}|{kind:"PLACEHOLDER",format:string}`

## Eligibility and author writes

- `GET /materials/:materialId/review-eligibility` (Bearer)
  - `{canReview, reasonCode:null|code, canEdit, editReasonCode:null|code,
currentReview:null|MaterialReview}`. `canEdit` is re-evaluated from the same live
    access/entitlement policy enforced by PATCH; refund therefore keeps the review visible
    but returns `canEdit=false` with `MATERIAL_ENTITLEMENT_REVOKED`.
  - Proposed reason codes: `MATERIAL_NOT_PUBLISHED`, `MATERIAL_OWNER_CANNOT_REVIEW`,
    `MATERIAL_ACCESS_REQUIRED`, `MATERIAL_PURCHASE_REQUIRED`,
    `MATERIAL_ENTITLEMENT_REVOKED`, `MATERIAL_REVIEW_ALREADY_EXISTS`.
- `POST /materials/:materialId/reviews` (Bearer, `Idempotency-Key`)
  - body `{rating:1..5, comment?:string}`; 201 new, 200 exact replay.
- `PATCH /material-reviews/:reviewId` (Bearer)
  - body `{expectedVersion, rating?:1..5, comment?:string|null}`.
- `DELETE /material-reviews/:reviewId` (Bearer)
  - query/body `expectedVersion`; 200 for exact replay.

## Buyer library and owner material management

- `GET /me/material-library/free?limit=20&cursor=...` (Bearer)
  - One row per currently public FREE material for which the caller has an `ISSUED`
    `FREE_PUBLIC` download grant.
  - Row: `{accessSource:"FREE_PUBLIC",firstAccessedAt,lastAccessedAt,material}`.
    `material` uses the public projection and always includes a signed `thumbnail` or
    deterministic placeholder. Ordering is `lastAccessedAt DESC, materialId DESC`.
- `GET /me/materials?status=ARCHIVED&limit=20&cursor=...` shows materials the
  authenticated owner stopped sharing. Omit `status` for the existing view without
  `ARCHIVED`. Cursors belong to the owner and exact filter. Start from the first page
  whenever the filter changes.
- `GET /me/materials/:materialId` reads the same projection as the owner list. Use it
  to reload status and version if an archive response is lost. Missing, foreign,
  deleted and unclassified legacy rows return `404 MATERIAL_NOT_FOUND`.
- Owner list/detail and mutation responses include `hasBeenPublished`, `canEdit`
  and nullable `editBlockedReason` (`MATERIAL_CONTENT_LOCKED` or `MATERIAL_NOT_EDITABLE`).
- `POST /me/materials/:materialId/archive` requires `{expectedListingVersion}` and moves `PUBLISHED`
  to `ARCHIVED`, returning the new `listingVersion`. Other manageable states return
  `409 MATERIAL_TRANSITION_INVALID`.
- `DELETE /me/materials/:materialId?expectedListingVersion=...` (Bearer) accepts an
  owned `DRAFT` or a manageable `ARCHIVED`. It records `deletedAt`, increments
  `listingVersion`, and returns `{id, deleted: true, replayed: false}`. The same owner
  receives `replayed: true` on retry after deletion. The row disappears from the owner
  list and detail. Bound files and purchase history are retained.
  - Unknown UUIDs, foreign rows and unclassified legacy rows return
    `404 MATERIAL_NOT_FOUND`.
  - Before deletion, a stale version returns `409 MATERIAL_VERSION_CONFLICT`.
    A current version in any other state returns `409 MATERIAL_DELETE_NOT_ALLOWED`.
  - A regular owner download for a deleted or unclassified legacy row returns
    `404 MATERIAL_NOT_FOUND`. Buyers with active entitlements retain access to
    their purchase snapshot under the existing moderation policy. Moderators
    retain access to the current file under their moderation permission.
- `PATCH /me/materials/:materialId` rejects `fileId:null` with
  `MATERIAL_FILE_REMOVAL_UNSUPPORTED`; omission still preserves the current file.
  Any PATCH of an ID that has ever been published returns `409 MATERIAL_CONTENT_LOCKED`,
  including after archive, resubmission, withdrawal or rejection. File, title,
  description, skill, cover, access type and price are all locked. Unpublished
  `DRAFT`/`REJECTED` are editable; `PENDING_REVIEW` must be withdrawn first.
- `POST /me/materials/:materialId/submit` accepts `DRAFT` or manageable `ARCHIVED`
  with required `{expectedListingVersion}`. It checks the bound file's current `READY` and `CLEAN` state and
  the recorded rights confirmation, then returns `PENDING_REVIEW` and a new
  `listingVersion` on the same ID. A file or rights failure returns
  `409 MATERIAL_FILE_REQUIRED`.
- Submit/archive compare the expected version under the same Material row lock as
  their mutation. Stale versions return `409 MATERIAL_VERSION_CONFLICT` with
  `details.currentStatus/currentListingVersion`; reload and confirm again.
  Missing/non-integer/non-positive versions return HTTP 400.
- Every approve/reject/hide/unhide increments `listingVersion`. Publication sets
  the permanent `hasBeenPublished` flag. Lifecycle transitions never clear it.
  Republish the same content on the same ID through review; changed content or
  pricing requires a new Material ID and a separate purchase. Existing order,
  file snapshot, entitlement and refund calculations retain their original values.
- `POST /me/materials/:materialId/withdraw` accepts `{expectedListingVersion}`
  for an owned `PENDING_REVIEW` material. It returns HTTP 200 and the owner
  projection with `DRAFT` and an incremented `listingVersion`. A stale version
  or changed state returns HTTP 409 with `details.currentStatus` and
  `details.currentListingVersion`. A request outside the caller's management
  scope returns `404 MATERIAL_NOT_FOUND`.

Thumbnail processing continues for manageable `ARCHIVED` materials. If a
verified legacy row has a `SUPERSEDED` thumbnail, the owner sees a placeholder.
Published covers cannot be replaced to request a new generation.

## Reporting and moderation

- `POST /material-reviews/:reviewId/reports` (Bearer)
  - body `{reasonCode, description}`.
- `GET /staff/material-reviews?status=REPORTED|HIDDEN&limit&cursor`
- `POST /staff/material-reviews/:reviewId/hide`
- `POST /staff/material-reviews/:reviewId/restore`
  - body `{expectedVersion, reason}`; requires `material-review:moderate`.

## Cover/thumbnail

- `POST /me/materials/cover-files` multipart image → scan status response.
- Extend create/update material DTO with `coverFileId?: UUID|null`.
- Existing owner file-status API may be generalized or a cover-specific status endpoint
  added; choose one contract before implementation and document it in Swagger.

## Write errors

`MATERIAL_REVIEW_NOT_FOUND` 404, `MATERIAL_REVIEW_FORBIDDEN` 403,
`MATERIAL_REVIEW_NOT_ALLOWED` 409 with `details.reason`,
`MATERIAL_REVIEW_EXISTS` 409, `MATERIAL_REVIEW_VERSION_CONFLICT` 409,
`MATERIAL_REVIEW_REPORT_EXISTS` 409, `MATERIAL_REVIEW_REASON_REQUIRED` 400,
`MATERIAL_COVER_INVALID` 400/415, `MATERIAL_COVER_NOT_READY` 409.

## Existing Materials hardening contracts

- `POST /materials/:materialId/purchase` keeps its public contract. After a refunded
  order, a new idempotency key creates a new order and reactivates the existing
  entitlement; it must not leak Prisma `P2002`.
- `GET /materials/:materialId/download` keeps its response contract. Concurrent failures
  cannot make a successfully issued link refundable.
- `POST /me/materials/files` adds `FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED` (413) for a
  structurally valid OOXML archive exceeding decompression safety bounds.
- The shared malware scanner accepts the full 20,000,000-byte material upload cap;
  lower purpose-specific caps remain enforced before scanning.
- `FILE_FORMAT_UNSUPPORTED` (415) remains reserved for a genuinely unsupported or
  structurally invalid format, not expansion size.
