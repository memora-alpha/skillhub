# Mobile list ordering and Chat sender contract

Date: 2026-10-30. Scope: API only, on `fix/backend-limits-inbox`.

Implementation follows the current dev module layout and preserves its existing
Conversation metadata, including `learningRequestId`. Application database
migration, backfill and deployment remain pending.

## Behavior and client changes

- `GET /api/v1/proposals`: `createdAt DESC, id DESC`. Default direction remains
  `received`; `sent` and new `all` use the same ordering. `all` is the union of the
  viewer's sent/received proposals, not a global feed. Status and request filters
  apply before pagination; the existing request-owner authorization is retained.
- `GET /api/v1/me/skills` and `GET /api/v1/profiles/:id/skills`: sharing-skill
  `createdAt DESC, id DESC`, with the sharing skill's own `createdAt` in each item.
  Public visibility, active-account and active-catalog rules remain intact.
- `GET /api/v1/conversations`: `lastActivityAt DESC, id DESC`. Empty conversations
  use `createdAt`. `lastActivityAt` is a derived PostgreSQL projection of published
  Mongo messages. It is updated in the delivery acknowledgement transaction,
  before notifications/SSE wakeups become visible. Duplicate/late workers cannot
  move it backwards. `learningRequestId` and all other dev metadata remain intact.
- History, send/delivery results and Inbox `lastMessage` include
  `sender: { id, fullName, avatarUrl }`, retaining `senderId`. Profiles are fetched
  in batches through Users; only public ACTIVE/CLEAN fields are used. If a sender's
  public profile is unavailable, the object retains its ID and returns null name
  and avatar. Avatar URLs are generated on read, never persisted in messages.
- SSE remains a reference stream. Hydrating a new message with the existing
  history/delivery APIs now supplies its sender without an extra profile call.

Cursors are opaque and scoped by viewer, filters and ordering version. Proposal
and sharing cursors carry `(createdAt, id)`; Inbox uses `(lastActivityAt, id)`.
Old ID-only cursors, invalid dates and cross-filter cursors return `400
INVALID_CURSOR`; clients must discard cached pagination state during rollout.
Creation timestamps are immutable, but Inbox activity can change while paging:
refresh from page one on a new chat event to observe promoted conversations.
This is live keyset pagination, not a frozen snapshot of the entire Inbox.

## Rollout

1. Apply migration `20261030000000_mobile_list_ordering`. It initializes existing
   conversations to their creation time and adds indexes for both participants
   and the sharing-skill chronology. Existing proposal chronology indexes are reused.
2. Build the API and run `pnpm --filter api chat:backfill-activity` against the
   intended PostgreSQL/Mongo pair **before exposing the new list order**. This
   reads existing published messages from Mongo in bounded batches and updates
   only older timestamps. It is safe to rerun and safe against concurrent new
   deliveries. Errors fail the command; never treat a failed run as completion.
3. Deploy/restart API/workers with the new code. During a mixed old/new rollout,
   old workers cannot maintain the projection; drain old workers and rerun the
   backfill before declaring the ordering current. New conversations use the DB
   creation timestamp automatically. New successful publications maintain it.
4. Reset mobile/web pagination caches. On a new SSE reference, hydrate the message
   and refresh Inbox page one. Client-side merge/sort of proposal directions is
   unnecessary when using `direction=all`.

Verification AI implementation and activation are outside this change.

## Constitution Check

- Modular ownership (1, 7): Pass for design. Users owns public identity; Proposals
  owns source titles; Conversations owns ordering and message delivery.
- Stores/transactions (2, 3, 8): Pass for design. Mongo owns content and sent time;
  PG ordering is explicitly derived and rebuildable. Projection, receipt and
  durable notification/events commit together. No financial changes. Backfill
  and profile/Mongo reads do not hold PG transactions across external I/O.
- Security/contracts (4, 5): Pass for design. Membership/owner restrictions and
  authorization rechecks remain. DTO/Swagger fields and cursor versions updated.
- Verification (6): See current results below; real datastore checks require
  isolated `TEST_DATABASE_URL`, `TEST_MONGODB_URI` and `TEST_REDIS_URL`.

## Validation

Completed on 2026-10-31:

- API TypeScript check, Nest build, ESLint and Prisma schema validation: passed.
- An isolated checkout containing exactly the staged API changes, without the
  separate AI work, passed Prisma generation, TypeScript checking and Nest build.
- Connections, cursor/list, rate-limit, identity, request/log privacy and Skills
  regressions on that checkout: **70 tests, 65 passed, 0 failed, 5 skipped**.
  Includes actual HTTP/Swagger module fixtures and the refresh credential quota.
- Skips require isolated PostgreSQL/MongoDB/Redis: ordering migration, acceptance
  migrations, schedule-text migration, Mongo publication/Inbox and Redis limits.
  No test datastore was configured; application databases were not used as a fallback.
- `git diff --check`: passed; no unresolved merge paths.

Test coverage includes equal timestamps with distinct IDs, sent/received/all
filters, request ownership, public visibility, old/invalid cursors, promotion from
later Inbox pages, sender parity, metadata preservation, duplicate delivery and
idempotent/race-safe backfill. A PostgreSQL migration check is gated by
`TEST_DATABASE_URL`; it never falls back to the application database.
