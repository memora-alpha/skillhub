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

`200` with `{ subscription | null, entitlements, usage | null, materialStorage }`.

- `subscription`: `{ id, planCode, planVersionId, interval, status, autoRenew, termStart, termEnd,
graceUntil, scheduledPlanCode, scheduledInterval, version }`.
- `entitlements`: the effective values for the user (FREE values when no subscription).
- `usage`: `{ periodStart, periodEnd, recordingMinutesAllowed, recordingMinutesUsed,
addonMinutesRemaining }`, only with a current subscription.
- `materialStorage`: `{ usedBytes, allowedBytes, enforced }` for every user, Free included. Byte counts
  are decimal strings. `enforced` is `false` while `subscription.enabled` is off, when no quota applies.

### `POST /me/subscription`

Header `Idempotency-Key` (required, 8–255 chars). Body
`{ planCode, interval, expectedPlanVersionId }`. `201` with the subscription.

Errors: `409 SUBSCRIPTION_ALREADY_ACTIVE`, `409 SUBSCRIPTION_RENEWAL_PENDING` (the term ended and the
renewal job has not processed it yet; retry shortly), `409 SUBSCRIPTION_PLAN_CHANGED`,
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

Header `Idempotency-Key`. Body `{ packs: 1–10, expectedPriceCredit }`, where `expectedPriceCredit` is the
whole-Credit price per pack shown to the user. `201` with the updated usage. The charge is
`packs × priceCredit`; the minutes are `packs × minutes` from `subscription.recordingAddon`, valid until the
term ends. Audit action `SUBSCRIPTION_RECORDING_ADDON`.
Errors: `400 RECORDING_ADDON_PACKS_INVALID`, `409 RECORDING_ADDON_NOT_ALLOWED` (no current plan, or the plan
does not allow add-ons), `409 RECORDING_ADDON_PRICE_CHANGED`, `409 INSUFFICIENT_AVAILABLE_CREDIT`,
`409 SUBSCRIPTION_RENEWAL_PENDING`, `409 IDEMPOTENCY_KEY_REUSED`.

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
| GET    | `/users/:userId`                | `subscription:read`   | Subscriptions, entitlements, usage, materialStorage and charges for one user   |

Each admin write writes an audit entry with the reason.

## Changed contracts in other modules

| Route / flow                                      | Change                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /sessions/:sessionId/recordings` (spec 020) | New errors `403 RECORDING_PLAN_REQUIRED`, `409 RECORDING_MINUTES_EXHAUSTED`.                             |
| Recording list/detail responses                   | Add `retentionDays`; `expiresAt` uses the snapshot.                                                      |
| Whiteboard responses (spec 019)                   | Add `retentionDays` once the Session has ended.                                                          |
| Material create/PATCH with `fileId`               | New error `409 MATERIAL_STORAGE_QUOTA_EXCEEDED` with `usedBytes`, `allowedBytes`, `fileBytes` (Phase 7). |
| Admin fee policies                                | `policyCode` accepts the four tier codes.                                                                |

## Events (outbox)

`subscription.renewed`, `subscription.grace-started` and `subscription.expired`, written by the
renewal job in the same transaction as the change. Each has an in-app notification for the owner
(grace start includes the amount due). Payloads carry ids, codes, amounts and times only.
Purchase and upgrade emit no event: the outbox fails events that have no publisher, and the
user sees the result in the response.

`PATCH /me/subscription` and the upgrade routes also return `409 SUBSCRIPTION_RENEWAL_PENDING`
in the same lapsed-term window as purchase.
