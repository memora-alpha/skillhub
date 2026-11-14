# HTTP Contracts: Admin Operations and API Hardening

All paths are under `/api/v1`, require Bearer authentication, and use the standard
SkillHub response envelope.

## Dashboard

- `GET /admin/dashboard/summary?from&to&timezone=Asia/Ho_Chi_Minh`
- `GET /admin/dashboard/trends?from&to&timezone=Asia/Ho_Chi_Minh&granularity=day`

Dates are ISO instants, `[from,to)`, maximum 366 days. v1 accepts only `day` granularity.
Each response includes one `asOf`; each section is
`{availability:"AVAILABLE",data:{...}}` or
`{availability:"UNAVAILABLE",errorCode:"..."}`.

## Work items

- `GET /admin/dashboard/work-items?limit&cursor&kind&severity&waitingOn&assignee&minAgeHours&q&sort`
- `GET /admin/dashboard/work-items/:kind/:id`

Kinds: `PAYMENT_REVIEW`, `SETTLEMENT_REVIEW`, `REPORT_CASE`, `REPORT_INCIDENT`,
`PATH_TERMINATION`, `SKILL_VERIFICATION`, `TAG_REQUEST`. Unknown kinds are rejected.
Cursor context includes all filters and sort. Detail reads append audit records.

## Learning paths

- `GET /admin/learning-paths?limit&cursor&status&participantId&q`
- `GET /admin/learning-paths/:pathId`

Responses exclude LiveKit tokens, chat bodies, evidence content, email addresses and
storage keys. Detail reads append audit records.

## Permissions and throttling

- `dashboard:read`: required for dashboard/work endpoints; ADMIN default only.
- `learning-path:read:admin`: required for admin path endpoints; ADMIN default only.
- 429 responses include `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, and
  `RateLimit-Reset`; these headers are exposed through CORS.
- `X-Device-Id` is optional, limited to 128 visible ASCII characters, and never echoed.
