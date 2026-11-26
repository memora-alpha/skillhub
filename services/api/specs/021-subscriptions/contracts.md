# Subscriptions — API Contracts

All routes are versioned `/api/v1`, authenticated, and return the standard envelope. Credit
amounts are decimal strings with two places (`"99.00"`). Times are ISO-8601 UTC.
When `subscription.enabled` is `false`, the routes that charge Credit (purchase, upgrade quote,
upgrade, recording minutes) return `403 SUBSCRIPTIONS_DISABLED`. Reads, `PATCH /me/subscription`
and admin routes stay available, so a paying user can always stop renewal and existing terms keep
their entitlements.

## Permissions

| Code                       | Roles              |
| -------------------------- | ------------------ |
| `subscription:manage:self` | USER, STAFF, ADMIN |
| `subscription:read`        | STAFF, ADMIN       |
| `subscription:manage`      | ADMIN              |

## User routes

### `GET /subscriptions/plans`

Effective approved versions. Response item:
`{ planCode, planVersionId, versionNo, monthPrice, yearPrice, entitlements, effectiveAt }`.

### `GET /me/subscription`

`200` with `{ subscription | null, entitlements, usage | null }`.

- `subscription`: `{ id, planCode, planVersionId, interval, status, autoRenew, termStart, termEnd,
graceUntil, scheduledPlanCode, scheduledInterval, version }`.
- `entitlements`: the effective values for the user (FREE values when no subscription).
- `usage`: `{ periodStart, periodEnd, recordingMinutesAllowed, recordingMinutesUsed,
addonMinutesRemaining, materialStorageBytesUsed, materialStorageBytesAllowed }`.

### `POST /me/subscription`

Header `Idempotency-Key` (required, 8–255 chars). Body
`{ planCode, interval, expectedPlanVersionId }`. `201` with the subscription.

Errors: `409 SUBSCRIPTION_ALREADY_ACTIVE`, `409 SUBSCRIPTION_PLAN_CHANGED`,
`409 INSUFFICIENT_AVAILABLE_CREDIT`, `409 IDEMPOTENCY_KEY_REUSED`, `404 SUBSCRIPTION_PLAN_NOT_FOUND`.

### `GET /me/subscription/upgrade-quote?planCode=PRO`

`200 { planCode, planVersionId, amount, termEnd, quotedAt, version }`. The amount follows D7 at
`quotedAt`; `version` is the subscription version to send as `expectedVersion`.

### `POST /me/subscription/upgrade`

Header `Idempotency-Key`. Body `{ planCode, expectedPlanVersionId, expectedAmount, expectedVersion }`.
The server recomputes the amount and rejects any difference with `409 SUBSCRIPTION_QUOTE_CHANGED`.
Errors also: `409 SUBSCRIPTION_NOT_ACTIVE`, `409 SUBSCRIPTION_NOT_AN_UPGRADE`, `409 SUBSCRIPTION_VERSION_CONFLICT`,
`409 INSUFFICIENT_AVAILABLE_CREDIT`.

### `PATCH /me/subscription`

Body `{ expectedVersion, autoRenew?, scheduledPlanCode?, scheduledInterval? }`. `null` clears a
scheduled change; omitted fields keep their value. A scheduled plan must not be an upgrade
(`409 USE_UPGRADE_ENDPOINT`). Errors: `409 SUBSCRIPTION_VERSION_CONFLICT`, `404 SUBSCRIPTION_NOT_FOUND`.

### `POST /me/subscription/recording-minutes`

Header `Idempotency-Key`. Body `{ packs: 1–10, expectedPriceCredit }`. `201` with the updated usage.
Errors: `409 RECORDING_ADDON_NOT_ALLOWED`, `409 RECORDING_ADDON_PRICE_CHANGED`,
`409 INSUFFICIENT_AVAILABLE_CREDIT`.

### `GET /me/subscription/charges?cursor&limit`

Cursor pagination, newest first. Item `{ id, kind, planCode, amount, quantity, createdAt }`.

## Admin routes (`/admin/subscriptions`)

| Method | Path                            | Permission            | Notes                                                                          |
| ------ | ------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| GET    | `/plans`                        | `subscription:read`   | All versions, filter by plan and status                                        |
| POST   | `/plans`                        | `subscription:manage` | Create DRAFT; body `{ planCode, monthPrice, yearPrice, entitlements, reason }` |
| POST   | `/plans/:planVersionId/approve` | `subscription:manage` | Body `{ effectiveAt, reason }`; `effectiveAt` not in the past                  |
| POST   | `/plans/:planVersionId/retire`  | `subscription:manage` | Body `{ reason }`; existing subscriptions keep their snapshot until renewal    |
| GET    | `/`                             | `subscription:read`   | Filter by status, plan, userId; cursor pagination                              |
| GET    | `/users/:userId`                | `subscription:read`   | Subscriptions, usage and charges for one user                                  |

Each admin write writes an audit entry with the reason.

## Changed contracts in other modules

| Route / flow                                      | Change                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /sessions/:sessionId/recordings` (spec 020) | New errors `403 RECORDING_PLAN_REQUIRED`, `409 RECORDING_MINUTES_EXHAUSTED`. |
| Recording list/detail responses                   | Add `retentionDays`; `expiresAt` uses the snapshot.                          |
| Whiteboard responses (spec 019)                   | Add `retentionDays` once the Session has ended.                              |
| Material attach/upload                            | New error `409 MATERIAL_STORAGE_QUOTA_EXCEEDED` (Phase 4).                   |
| Admin fee policies                                | `policyCode` accepts the four tier codes.                                    |

## Events (outbox)

`subscription.activated`, `subscription.renewed`, `subscription.grace_started`,
`subscription.expired`, `subscription.plan_changed`. Notifications send in-app messages for
grace start (with the missing Credit) and expiry. Payloads carry ids and codes only.
