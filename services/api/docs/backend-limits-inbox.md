# Backend rate limits and Inbox enrichment

Branch: `fix/backend-limits-inbox`. Scope: API only; no frontend changes or deployment.

2026-10-30: integrated onto current dev (`0825a5d3`). The subsequent
[mobile list contract update](mobile-list-contracts.md) replaces ID ordering with
time-based cursors, adds Chat sender projections and a PostgreSQL activity
projection migration/backfill. The original limits/Inbox checks below are
historical; see that document for the current rollout and validation.

## Design and Constitution Check

- Modular ownership: Conversations uses the users owner's batched ProfileReader
  and the proposal owner's read-only ConversationTopicReader. Repositories remain
  in their owning modules. PostgreSQL owns membership and source references;
  MongoDB owns published messages and read watermarks. No new persisted copies.
- Transactions: existing proposal/chat locks, idempotency, audit and outbox are
  preserved. No storage or Redis calls are added inside their PG transactions.
  Inbox external I/O occurs after the page transaction; identity/restrictions are
  checked again before previews are returned. Existing ID cursor order is retained.
- Security: validate explicit proxy IPs/CIDRs; defaults trust no proxy. Partner
  projections include only ACTIVE user public fields and CLEAN avatar URLs.
  Rate-limit keys use HMAC. Error metadata/logs omit raw tokens, email, IP and UA.
- Public contract: additive Inbox list fields and 429 details/Retry-After.
  Detail/accept Conversation metadata and existing error messages stay compatible.
  Swagger and the Connections HTTP contract document the additive fields.
- Financial state and cross-store delivery semantics are unchanged. No migration,
  seed, commit, push or deployment is part of this change.
- Verification: behavioral tests cover quota isolation, refresh credentials,
  client hints, proxy/header handling, Inbox batching, outage and revocation.
  Real Mongo/Redis verification requires isolated test services; see results below.

## Rate-limit behavior

The global HTTP guard applies an IP abuse cap per controller group. After live
authentication, IdentityGuard also applies user and session caps to the same group.
Groups come from server controller metadata, never user input, resource IDs or
query strings. Inbox traffic does not consume another controller group's quota.
Users cannot evade their user cap by creating sessions or changing IPs.

Existing `IDENTITY_REQUEST_RATE_LIMIT` now controls each group's IP cap.
`IDENTITY_USER_REQUEST_RATE_LIMIT` defaults to that value;
`IDENTITY_SESSION_REQUEST_RATE_LIMIT` defaults to the user cap. Blank optional
values inherit these settings. Keep the IP cap large enough for legitimate users
sharing NAT; tune from measured traffic rather than increasing all limits blindly.
The common throttle window remains `IDENTITY_THROTTLE_WINDOW_SECONDS`.

Auth still checks subject and purpose-specific IP quotas. The legacy
`IDENTITY_DEVICE_RATE_LIMIT` now caps a subject/IP/UA combination, not every client
with the same UA. This is an abuse signal, not a physical-device identity.
Refresh uses each opaque credential as its HMAC input instead of a global literal.
Rotation does not provide a stable refresh-session quota; the purpose-specific IP
cap remains active for that unauthenticated endpoint. Logged-in API calls use the
validated user/session quotas.

All API-owned 429 paths emit `Retry-After` (seconds) and additive details:
`limiter`, `scope`, `dimension`, `retryAfterSeconds`, `resetAt`. Browser CORS exposes
the header. Redis counters return their remaining TTL atomically. Chat/proposal
rolling windows use the limit-th newest record's expiration; cooldown uses the
latest matching invitation. SSE uses the blocking lease's expiry. These are retry
hints: concurrent traffic or renewed SSE leases may extend the wait.

Structured `http.rate_limited` logs contain request/correlation IDs, method/path
without query parameters and the public limiter metadata. Proxy diagnostics expose
only whether a forwarded header exists and whether resolved client IP equals the
socket peer. Correlate these with reverse-proxy access logs for incident diagnosis.

## Deployment configuration

1. Verify the deployed proxy chain and that the last trusted proxy overwrites
   forwarded headers. Set `TRUSTED_PROXY_CIDRS` to its exact addresses/subnets,
   comma-separated. Blank keeps direct-client behavior. Blanket `true`, hop counts,
   named broad ranges and `/0` are rejected. Do not guess production CIDRs.
2. Review per-group IP/user/session caps for the deployment's traffic. Key format
   changes start new counters during rollout; old keys expire naturally. Mixed
   old/new replicas use separate counters until rollout finishes.
3. MongoDB 8 is the project's baseline. Inbox uses a database-level `$documents`
   aggregation (MongoDB 6+) and indexed `$lookup` on the existing
   `published_history` index. Ensure `pnpm db:migrate:chat` has already installed
   the documented chat indexes. No new indexes or schema migration are required.
4. After rollout, verify two independent clients' proxy resolution, cross-user
   isolation, browser Retry-After access and Inbox summaries against real stores.

## Inbox semantics

The list adds partner, source topic, last published message and unread count.
Own messages and DRAFT messages never count as unread. A healthy empty conversation
returns null preview/count 0. A Mongo outage or query timeout returns
`summaryAvailable:false`, null preview and null count; PG metadata remains visible.
Read watermarks are eventually observed; a concurrent mark-read may change counts
on the next fetch. Private storage metadata is never included in previews.

Profile/source queries are batched per page. Mongo reads the page's watermarks once
and runs one aggregation with bounded, indexed lookups for previews and unread.
Unread is bounded by each preview's sequence; new arrivals appear on a later fetch.
The summary queries have a 5-second server deadline. Recent-activity ordering and
durable unread projections are separate work, not silently introduced here.

## Validation results

Completed against the final implementation:

- `pnpm exec tsc --noEmit`, `pnpm exec nest build` and `pnpm lint`: passed.
- Identity, Connections, request-context and log-privacy regression selection:
  **57 tests: 53 passed, 0 failed, 4 skipped**. Includes a real localhost HTTP
  application validating group/user isolation, trusted/untrusted forwarded headers,
  Retry-After/CORS and redacted 429 diagnostics. Local adapter fixtures also passed.
- Skips: real MongoDB replica-set test, PostgreSQL acceptance/migration test,
  PostgreSQL schedule-migration test and Redis Lua/lease test. The required isolated
  `TEST_MONGODB_URI`, `TEST_DATABASE_URL` and `TEST_REDIS_URL` were not configured;
  Docker Desktop's Linux daemon was unavailable. No application DB fallback used.
- The sandbox initially blocked localhost fixture connections with EACCES. The
  same suites passed when run with permission for local loopback connections.
- `git diff --check`: passed. Pre-existing Verification AI and AI planning changes
  remain outside this change's scope.

Focused entry point: `pnpm --filter api test:backend-limits-inbox`. The MongoDB
Inbox assertions are in `test/connections/mongo.integration.test.mjs`, run with
`TEST_MONGODB_URI` pointing at an isolated replica set. The real Redis test uses
only a per-run key prefix and deletes its own keys on completion.

Production proxy settings, datastore execution/performance, real-provider behavior
and deployment remain unverified locally.
