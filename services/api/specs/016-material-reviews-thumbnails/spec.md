# Feature Specification: Material Reviews and Thumbnails

**Feature Branch**: `feat/material-reviews-thumbnails`

**Created**: 2026-11-14

**Status**: Approved for implementation — D1–D4 approved 2026-11-14

**Input**: Bug/request sheets plus the supplied material-review and thumbnail notes.

## Current-state findings

- `Material`, `MaterialOrder`, and `MaterialEntitlement` exist; `MaterialReview` does not.
- Public material detail is metadata-only and has no rating summary or thumbnail.
- Material reporting exists, but review reporting/moderation does not.
- General learning-path reviews are a separate aggregate and must not be reused.
- The existing Materials spec explicitly deferred file preview/thumbnail generation.

## User Scenarios & Testing

### US0 — Repair purchase/download/file-validation races (P0)

The existing Materials flow must be made safe before review eligibility depends on
purchase/access history:

- A buyer can purchase again after a refund without creating a second entitlement row
  or hitting Prisma `P2002` on `(userId, materialId)`.
- Concurrent download attempts cannot erase proof that any signed link was issued. A
  failed signing attempt must never clear `consumedAt` or equivalent successful-access
  evidence written by another request.
- A valid DOCX such as the observed 38 KB → 832 KB sample is not rejected only because
  its expansion ratio exceeds 10×. Zip-bomb protection remains bounded by ratio,
  absolute expanded bytes, entry count, central-directory size, and captured XML size.
- Exceeding an archive expansion limit returns a dedicated code rather than
  `FILE_FORMAT_UNSUPPORTED`, so clients can explain the real failure.

**Independent test**: refund then repurchase the same material; race one successful and
one failed download-signing request; accept a >10× valid DOCX fixture; reject an archive
over the configured safety bounds with the dedicated error code.

### US1 — Read visible reviews and summary (P1)

A visitor can read paginated visible reviews for a published material. Each row has
review ID, reviewer public identity (ID, name, avatar), rating, comment,
`verifiedPurchase`, `createdAt`, and `updatedAt`. Material detail exposes a summary
computed from visible reviews only: average, total, and counts for stars 1–5.

**Independent test**: Seed visible and hidden reviews, then prove the page and summary
exclude hidden rows and preserve stable `createdAt DESC, id DESC` pagination.

### US2 — Explain and enforce review eligibility (P1)

An authenticated user can ask whether they may review a material. The response includes
`canReview`, a machine-readable reason when false, and the caller's current review when
one exists. Create/update/delete recheck the same policy inside the write transaction.

**Independent test**: Exercise owner, unrelated user, eligible buyer, refunded buyer,
duplicate create, stale update, and delete ownership cases.

### US3 — Create, edit, and delete a review (P1)

An eligible user creates one active review per material with rating 1–5 and an optional
bounded comment. Only its author may edit or delete it. Delete is a soft delete so audit,
moderation history, and duplicate prevention remain explainable.

**Independent test**: Concurrent creates produce one review; stale writes fail; deleting
removes the row from public pages and summary without erasing history.

### US4 — Report and moderate a review (P2)

Users can report an abusive review independently from reporting the material. Staff with
the explicit permission can list reported reviews and hide/restore a review with a reason.
Every moderation action is audited. Hidden reviews do not contribute to public summary.

**Independent test**: Report a review, hide it, verify page/summary change atomically,
then restore it and verify the summary returns without modifying the review text.

### US5 — Material cover/thumbnail (P2)

An owner may upload a cover image. The backend validates/scans it, generates normalized
thumbnail variants asynchronously, and exposes only safe short-lived/public-cacheable
delivery URLs according to the storage policy. If no custom cover exists, the API returns
a deterministic format placeholder; document-page rendering is not required for MVP.

**Independent test**: Upload valid/invalid images, retry the generation job, replace the
cover, and verify public material responses never expose object/storage keys.

## Functional Requirements

- **FR-001**: `GET /api/v1/materials/:materialId/reviews` MUST paginate visible reviews
  using a viewer-independent opaque cursor ordered by `createdAt DESC, id DESC`.
- **FR-002**: Public review rows MUST include reviewer public name/avatar and MUST NOT
  expose email, order ID, entitlement ID, or private profile fields.
- **FR-003**: `GET /api/v1/materials/:materialId/review-eligibility` MUST require auth and
  return `{canReview, reason, review}`.
- **FR-004**: `POST /api/v1/materials/:materialId/reviews` MUST be idempotent under retry
  and safe under concurrent requests. One active review per user/material is enforced.
- **FR-005**: `PATCH /api/v1/material-reviews/:reviewId` MUST require
  `expectedVersion`; rating is integer 1–5; comment is normalized and bounded.
- **FR-006**: `DELETE /api/v1/material-reviews/:reviewId` MUST soft-delete only the
  caller's review and be replay-safe.
- **FR-007**: Summary MUST count only `VISIBLE` and non-deleted reviews and be updated in
  the same PostgreSQL transaction as create/update/delete/moderation.
- **FR-008**: `POST /api/v1/material-reviews/:reviewId/reports` MUST create a review
  report distinct from an existing material report and dedupe one active report per
  reporter/review.
- **FR-009**: Staff moderation MUST support hide/restore, require a reason, enforce
  `material-review:moderate`, and append audit records.
- **FR-010**: Material detail/list projections SHOULD expose `ratingSummary` and
  `thumbnail`; review list MUST also return the summary to avoid a second request.
- **FR-011**: Cover upload MUST accept only JPEG/PNG/WebP, reject SVG, use the private
  file pipeline, and generate at least 320×180 and 640×360 WebP variants.
- **FR-012**: Thumbnail generation MUST be idempotent, retryable, and must never run
  before the cover file is `READY/CLEAN`.
- **FR-013**: Replacing/removing a cover MUST bump `listingVersion` and return a published
  material to `PENDING_REVIEW`, because the public visual is moderated content.
- **FR-014**: Review writes, moderation, and projection changes MUST publish Swagger
  contracts and behavioral tests.
- **FR-015**: Repurchase after refund MUST reactivate/update the existing entitlement
  under a user/material lock instead of inserting a conflicting row. The new order is
  linked atomically and the old refunded order remains immutable history.
- **FR-016**: Download issuance MUST use a durable attempt/grant state. Refund eligibility
  MUST reject an issued grant and a non-expired in-flight grant. A failed request may
  mark only its own attempt failed; it MUST NOT clear order-level consumption evidence.
- **FR-017**: Stale in-flight download grants MUST expire only after the possible signed
  URL TTL, so a crash cannot reopen refund while a usable link may still exist.
- **FR-018**: OOXML expansion validation MUST use a reviewed ratio of at least 22× for
  the supplied DOCX fixture while retaining the existing 100 MB absolute cap and other
  structural limits. The proposed implementation target is 50×, pending security review.
- **FR-019**: Expansion-limit failures MUST return
  `FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED` (413). Invalid OOXML structure, encryption,
  macros, MIME mismatch, and unsupported formats keep their existing distinct errors.

## Approved product decisions

| ID  | Decision                            | Approved policy                                                                                     |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| D1  | Who may review FREE materials?      | Any authenticated non-owner after one successfully issued backend download grant.                   |
| D2  | Who may review PAID materials?      | Only an ACTIVE purchase entitlement; never accept a client-provided purchase flag.                  |
| D3  | How many reviews per user/material? | One active review, editable; a soft-deleted review may be recreated.                                |
| D4  | What happens after refund?          | Keep the review visible, compute `verifiedPurchase=false`, and block a new review until repurchase. |

`verifiedPurchase` is a read-time projection from the current ACTIVE purchase
entitlement. It becomes false after refund and true again after repurchase without
rewriting review history.

## Key Entities

- **MaterialReview**: author-owned rating/comment with version, visibility, and soft-delete state.
- **MaterialRatingSummary**: transactionally maintained projection for visible review counts.
- **MaterialReviewReport**: report lifecycle specific to a review.
- **MaterialThumbnail**: generated derivative metadata; bytes remain in S3-compatible storage.
- **MaterialDownloadGrant**: one signing attempt with `PENDING`, `ISSUED`, `FAILED`, or
  `EXPIRED` state used to make refund/download concurrency explainable and recoverable.

## Success Criteria

- Public page and summary remain consistent after every write/moderation transaction.
- Concurrent duplicate review creation produces at most one active review.
- No public response exposes private purchase identifiers or storage keys.
- Focused unit/HTTP tests pass and PostgreSQL integration tests cover concurrency,
  summary consistency, authorization, moderation, and retry recovery.

## Out of scope

- Mobile/web UI implementation.
- Recommendation/ranking changes based on review score.
- Rendering the first page of PDF/DOCX/PPTX/XLSX into a thumbnail in MVP.
- Reusing learning-path reviews or material reports as review records/reports.
