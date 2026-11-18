# Backend contracts for web integration

All routes below use `/api/v1`. The changes are limited to the API; web/mobile source is unchanged.

## Work queue

`GET /admin/dashboard/work-items` retains its current query and response contract. The API now applies `kind`, `q`, `severity`, `waitingOn`, `assignee` and `minAgeHours` before limiting each source. It merges at most `limit + 1` rows per source. Ordering is `receivedAt ASC` (`sort=oldest`, default) or `DESC` (`sort=newest`), then `kind ASC,id ASC` in code-unit order. The cursor carries all three values and binds all filters and sort. Restart from page one after changing filters. More than 101 records at the same timestamp no longer stop pagination.

## Effective permissions

`GET /me` adds `data.permissions: string[]`, sorted deterministically. These are the effective permissions from the same stored role/default/participation and STAFF GRANT/DENY resolver used by authentication, rather than permissions inferred by FE from a role. Reload `/me` after changing permissions. Use permission codes to show navigation/actions; resource ownership, restrictions and state/version checks still run on the API.

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {
    "userId": "...",
    "roles": ["STAFF"],
    "permissions": ["material:moderate", "report:moderate"]
  }
}
```

This example omits existing identity/profile fields.

## Chat contact guard

`POST /conversations/:id/messages` rejects detected contact details with HTTP 400:

```json
{
  "success": false,
  "message": "CONTACT_INFORMATION_NOT_ALLOWED",
  "statusCode": 400
}
```

Show an inline message asking the sender to remove contact details. Validation runs on normalized message text before chat readiness, publication receipt allocation, PostgreSQL transactions, MongoDB drafts and outbox publication. Rejected text is never persisted by the send operation.

The detector covers email, Vietnamese mobile/landline numbers, explicit international `+` numbers, contact URI schemes and recognized messaging/social-profile links (including Zalo, WhatsApp, Telegram, Messenger, Facebook/Instagram profiles, LinkedIn, Discord and Line). Detection normalizes full-width characters and invisible formatting without rewriting persisted text. Ordinary learning URLs and schedules remain allowed. Attachment content, OCR and arbitrary disguised contact information are outside this text guard. This is an intentional tightening of chat validation, explicitly requested on 2026-11-18.

## Material search and personal library

| Route                           | Pagination                            | Search/filter behavior                                                                               |
| ------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /materials`                | Existing `page`, `limit` (maximum 50) | Public PUBLISHED/CLEAN documents                                                                     |
| `GET /staff/materials`          | `limit`, `cursor`                     | Default `PENDING_REVIEW`; explicit `status=ALL` searches all staff-visible statuses, excluding DRAFT |
| `GET /me/materials`             | `limit`, `cursor`                     | Authenticated owner only; existing `status` behavior retained                                        |
| `GET /me/material-favorites`    | `limit`, `cursor`                     | Caller's saved, currently PUBLISHED/CLEAN documents                                                  |
| `GET /me/material-library/free` | `limit`, `cursor`                     | Caller's successful FREE download history, retaining public availability checks                      |
| `GET /me/material-orders`       | `limit`, `cursor`                     | Caller's orders; title/filename search uses immutable purchase snapshots                             |

All accept `q`, `skillId`, `accessType`, `from`, `to`; all except owner management also accept `ownerId`. Owner management rejects an `ownerId` query field rather than allowing it to replace the authenticated owner. `q` is a trimmed, case-insensitive substring search of material title/description; order search uses purchased title/original filename, and its `ownerId` means the historical seller.

`from` is inclusive and `to` exclusive on **material creation time**, including personal lists. Supply full RFC3339 instants with a timezone, for example `from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`. Malformed, timezone-less or non-increasing intervals return 400; range validation uses `INVALID_MATERIAL_TIME_RANGE` and DTO validation may return field errors. Filters run before page limits; existing list ordering remains unchanged. Cursor pages bind caller and filters; restart without cursor after changing a filter.

## Material moderation history

`GET /staff/materials/:materialId/moderation-history?limit=20&cursor=...` requires STAFF/ADMIN and `material:moderate`. It returns append-only `MATERIAL_MODERATE` decisions ordered `occurredAt DESC,id DESC`:

```ts
type MaterialModerationHistory = {
  id: string;
  action: "approve" | "reject" | "hide" | "unhide" | "unknown";
  actor: {
    kind: string | null;
    userId: string | null;
    roles: string[];
    systemActor: string | null;
  };
  occurredAt: string;
  reason: string | null;
  previousStatus: string | null;
  status: string | null;
  reviewedListingVersion: number | null;
  listingVersion: number | null;
};
```

Versions identify the reviewed listing and resulting listing. Historical missing metadata remains `null`/`unknown`; arbitrary audit snapshots and file/storage information are not returned. Existing material IDs without decisions return an empty page; nonexistent IDs return 404.

## Administrative audit reader

`GET /admin/audit-logs` requires **ADMIN and `audit:read`**. STAFF cannot gain this API through operational overrides. Filters: `actorId` (UUID), `action` (exact action code), `targetType`, `targetId`, `from`, `to`, `limit` (1–100, default 20), `cursor`. Date bounds use `[from,to)` on audit `createdAt`, with absolute timezone-bearing instants.

Each row contains `id`, `actorKind`, `actorId`, historical `actorRole`, `actorRoles`, `systemActor`, `action`, `targetType`, `targetId`, `reason`, `createdAt`, `requestId`, `correlationId`. Nullable historical fields remain nullable. Raw before/after snapshots, IP and user agent are excluded. Ordering is `createdAt DESC,id DESC`; cursors bind the viewer and normalized filters. Invalid/reused cursors return 400 `INVALID_CURSOR`; insufficient access returns 403 `AUDIT_READ_PERMISSION_REQUIRED`.

Cursor-based routes use the existing envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": [],
  "meta": {
    "pagination": { "limit": 20, "hasMore": false, "nextCursor": null }
  }
}
```

## Rollout

No new migration or environment variable is required. Existing migration prerequisites remain in effect. Run the existing `pnpm --filter api identity:seed` workflow to add `audit:read` to the permission catalog and ADMIN role, then restart/deploy the API. Until seeded, audit access returns 403. This work does not execute the seed against the application database or deploy the API.

## Report ruling eligibility

`GET /reports/staff/:caseId` adds `data.resolutionOptions`. It is `null` when the case has no related Session. Otherwise it projects the committed state that `POST /reports/staff/:caseId/resolve` checks for `noShowRuling` and `cancellationMakeupRuling`:

```json
{
  "makeupQuotas": [
    {
      "userId": "...",
      "reason": "SESSION_MAKEUP_LIMIT_REACHED",
      "remaining": 1
    }
  ],
  "eligibleMakeupUserIds": [],
  "makeupAlreadyGranted": false,
  "obligationsEnded": false,
  "noShowRulings": [
    {
      "value": "UPHOLD",
      "allowed": false,
      "blockedReason": "SESSION_MAKEUP_LIMIT_REACHED"
    },
    {
      "value": "EXCUSE",
      "allowed": false,
      "blockedReason": "SESSION_MAKEUP_LIMIT_REACHED"
    },
    { "value": "COMPLETE", "allowed": true, "blockedReason": null }
  ],
  "cancellationMakeupRulings": [
    {
      "value": "EXTEND",
      "allowed": false,
      "blockedReason": "CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE"
    },
    {
      "value": "COMPLETE",
      "allowed": false,
      "blockedReason": "CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE"
    }
  ]
}
```

- `makeupQuotas` lists both participants. `reason` is `SESSION_MAKEUP_LIMIT_REACHED` (this Session already used its makeup), `MAKEUP_ATTRIBUTION_REVIEW_REQUIRED` or `USER_MAKEUP_LIMIT_REACHED`; `eligibleMakeupUserIds` are participants without a reason.
- `makeupAlreadyGranted` is `evidence.makeupGranted` of the current occurrence's attendance outcome. A ruling then extends that makeup and never reserves a second one. It does not mean the makeup lesson took place.
- `obligationsEnded` means the Learning Path termination was approved; a ruling finalizes attendance without a makeup.
- `UPHOLD` requires an absent attendance case on a `NO_SHOW` Session. Teacher or both absent then needs a makeup, so the absent parties' quota applies; learner absent does not. `EXCUSE` uses the absent parties' quota, or the selected participant when nobody is absent. `COMPLETE` is not limited by quota.
- Values are advisory and computed without locks. Resolve revalidates in its transaction and may still return 409 with the same codes, for example after a concurrent change. Reload the case before retrying.
- No-show and cancellation rulings do not refund or penalize Credit; Credit penalty/refund rates for no-show remain an open product decision.
