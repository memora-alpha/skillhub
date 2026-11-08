# Completion-gap API contracts

All routes use `/api/v1`, authenticated access and the existing response envelope.
No new environment variables. Apply `20261109000000_backend_completion_gaps` first.

## Lists and public profile

- `GET /me/skills` and public profile sharing-skill lists: `createdAt DESC, id DESC`,
  with `createdAt` included. Start at page one after deploying; previous ID cursors
  are rejected. Skills catalog and sharer-search cursors keep their existing order.
- `GET /sessions/mine?from=&to=&limit=20&cursor=`: `startAt ASC, id ASC`;
  cursor binds the viewer and filters and preserves implicit first-page `now`.
- `GET /me/materials?limit=20&cursor=`: `updatedAt DESC, id DESC`.
- `GET /me/material-orders?limit=20&cursor=`: `createdAt DESC, id DESC`.
- `GET /staff/materials?status=&limit=20&cursor=`: `updatedAt ASC, id ASC`;
  cursor binds moderator and status. Existing material moderation permissions apply.
- These routes retain array `data` and add `meta.pagination` with `limit`,
  `hasMore`, `nextCursor`; limits 1..100. Clients must follow cursors rather than
  assume a single response contains the complete list. Cursor input errors are 400.
- Own/public profile adds `completedLearningPathCount`: distinct Paths where user
  participates and status is COMPLETED with non-null settledAt. Sessions and stopped
  Paths do not count. `completedSessionCount` retains its original meaning.
- New termination requests after all sessions are COMPLETED return
  `409 PATH_ALREADY_LEARNING_FINISHED`; prior same-key/body replay is preserved.
  Existing pending termination requests are not automatically removed or settled.

## Profile moderation

- `GET /staff/users/:userId/profile-moderation`: target content, updatedAt and
  moderation state. Requires live STAFF/ADMIN + `profile:moderate`; self denied.
- `POST` same route: `{field:"BIO"|"AVATAR", action:"HIDE"|"REQUEST_EDIT",
expectedUpdatedAt, reason}`. Rechecks authorization under sorted user locks;
  stale content gives 409. Changes and reasoned audit commit together.
- Hidden bio is withheld from public profile; owner can read and correct it.
  Avatar hide deselects it and cancels CLEAN/QUARANTINED uploads, so pending scan
  jobs cannot restore it. Replacing a bio/avatar clears that field's current notice.
- Own profile includes `profileModeration`; public profiles omit private notices.
  Request-edit records the requested field and reason without hiding content.

## Review moderation

- `GET /staff/reviews?limit=&cursor=` includes hidden reviews, moderationVersion.
- `POST /staff/reviews/:id/moderation`: `{hidden:boolean, expectedVersion, reason}`.
- Live STAFF/ADMIN with `review:moderate`; reviewer/reviewee cannot moderate the
  review themselves. Version check, row lock and audit are atomic. Invalid/stale
  requests have no effect. Hide/restore removes/restores the whole review and its
  stars in public lists/summary. Original reputation score/history is unchanged.

## Notification preferences

- `GET /me/notification-preferences`: `{learning,credit,community}` booleans.
- `PATCH` same route: any subset of those booleans. Omitted keeps current;
  explicit null/unknown fields rejected. Defaults are all true for existing users.
- Applied independently per recipient at channel delivery and direct chat/proposal
  notification creation. Existing inbox history stays. Authentication/security and
  unmapped events keep existing delivery behavior. No retroactive delivery on re-enable.
- Learning: learning paths/requests, sessions, proposals, chat, report cases.
  Credit: payment/wallet/Credit, path settlement and material purchase/refund.
  Community: skills/verifications, other material events, badges/achievements/reputation.

## Fee administration

- `GET /admin/fee-policies?limit=&cursor=`: all policy versions, plus `effective`
  only for the currently selected approved/effective version of each code.
- `POST /admin/fee-policies/material`: `{versionNo,feeBps,reason,reauthToken}`.
  versionNo is latest existing material version + 1; concurrent duplicate version
  returns 409 without consuming proof. feeBps is integer 0..9999 (500 = 5%).
  Creates an immutable DRAFT; corrections use a new version.
- `POST /admin/fee-policies/:id/approve`: `{reason,reauthToken,effectiveAt?}`.
  DRAFT MATERIAL_PAID only. Omitted effectiveAt uses database now; past dates,
  nonincreasing effective times and version regressions rejected. A higher version
  scheduled for the future does not affect purchases before its effectiveAt.
  Explicit effectiveAt, report from and report to require a timezone (Z or offset).
- Both commands require ADMIN + `fee-policy:manage`, current one-use reauth proof,
  serialized policy-series lock and audit. Same Admin can create and approve.
  Approved policies have no update/delete API. Learning policy changes are rejected;
  ONE_WAY/TWO_WAY remain 4%. Existing order snapshots/rounding are preserved.
- `GET /admin/fee-revenue?from=&to=&granularity=day|month`: ADMIN + `credit:read:any`.
  Range is `[from,to)` up to 366 days; UTC day/month grouping by operation type.
  Returns decimal-string `collectedCredit`, `refundedCredit`, `netCredit`.
  Collected fees come from successful PLATFORM_FEE ledger entries. Material refund
  fee restitution is the sum of the refund operation's wallet deltas, counted at
  refund time. Other Available adjustments do not reverse a recorded platform fee.
  No provider lookup, balance update, Credit penalty policy or VND profit calculation.

## Permissions and deployment

Migration installs new permissions for Admin. Staff gains profile/review moderation
only when Admin grants it through existing Staff overrides. No financial management
permission is delegable to Staff. Frontend must add controls and read pagination;
UI changes and deployment are outside this backend fix.
The migration additionally permits REFUNDED material orders, fixing the old
SUCCESS-only constraint that prevented the existing refund workflow from committing.
