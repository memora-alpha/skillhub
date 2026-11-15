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
  - `{canReview, reason:null|code, review:null|MaterialReview}`
  - Proposed reason codes: `MATERIAL_NOT_PUBLISHED`, `MATERIAL_OWNER_CANNOT_REVIEW`,
    `MATERIAL_ACCESS_REQUIRED`, `MATERIAL_PURCHASE_REQUIRED`,
    `MATERIAL_ENTITLEMENT_REVOKED`, `MATERIAL_REVIEW_ALREADY_EXISTS`.
- `POST /materials/:materialId/reviews` (Bearer, `Idempotency-Key`)
  - body `{rating:1..5, comment?:string}`; 201 new, 200 exact replay.
- `PATCH /material-reviews/:reviewId` (Bearer)
  - body `{expectedVersion, rating?:1..5, comment?:string|null}`.
- `DELETE /material-reviews/:reviewId` (Bearer)
  - query/body `expectedVersion`; 200 for exact replay.

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
- `FILE_FORMAT_UNSUPPORTED` (415) remains reserved for a genuinely unsupported or
  structurally invalid format, not expansion size.
