# Request-grouped Inbox

Date: 2026-11-03. Scope: backend API, extending Connections.

Ordering follow-up 2026-11-04: flat `GET /conversations` (including the child
Request filter) now orders by `lastActivityAt DESC, id DESC` and returns activity
metadata. Proposal lists use `createdAt DESC, id DESC`, with `direction=all` for
one combined sent/received page. Both use new order-scoped timestamp/ID cursors;
old cursors require a first-page refresh. See the
[HTTP contract](../specs/008-connections/contracts/http.md). This requires no new
migration beyond the activity migration/backfill described below.

## Decisions and behavior

- User decision: owners, previous proposers and Conversation participants may
  continue reading the Request title after it closes or stops being public.
  This grants title-only context; public Request detail/body access is unchanged.
- Received proposal totals include all history: PENDING, ACCEPTED, REJECTED,
  WITHDRAWN and EXPIRED. They are returned only to the Request owner. Other viewers
  receive null for this private total and a count of their own sent proposals.
- Conversation totals count only rows where the live viewer is a participant.
  Both existing `conversation:read:participant` and `proposal:read:party` grants
  are required for the combined Inbox, with existing account/restriction checks.
- Owners see a group when it has received proposals, including groups without
  any chat. Previous rejected/withdrawn proposals still count. A sender with only
  proposals and no accessible chat uses the Sent proposal screen instead.
- Direct-search Conversations have no Request. Each remains a separate direct
  group; Request-specific proposal totals are null, not a misleading zero.

## API

`GET /api/v1/conversations/inbox?limit=20&cursor=...`

Standard success envelope and `meta.pagination`; default limit 20, maximum 100.
Example Request group:

```json
{
  "id": "request:00000000-0000-4000-8000-000000000001",
  "groupType": "LEARNING_REQUEST",
  "learningRequestId": "00000000-0000-4000-8000-000000000001",
  "conversationId": null,
  "title": "Luyện phỏng vấn tiếng Anh",
  "viewerRole": "OWNER",
  "receivedProposalCount": 25,
  "sentProposalCount": 0,
  "conversationCount": 4,
  "lastActivityAt": "2026-11-03T03:00:00.000Z",
  "latestMessage": {
    "id": "00000000-0000-4000-8000-000000000010",
    "conversationId": "00000000-0000-4000-8000-000000000020",
    "senderId": "00000000-0000-4000-8000-000000000030",
    "messageType": "TEXT",
    "preview": "Mình gửi bạn tài liệu cho buổi học tới.",
    "sentAt": "2026-11-03T03:00:00.000Z"
  },
  "hasUnread": true
}
```

`viewerRole` is OWNER, PROPOSER or PARTICIPANT. Direct groups use
`groupType=DIRECT_CONVERSATION`, `id=conversation:<uuid>`, `conversationId`,
`learningRequestId=null` and the source skill topic as title. Message previews are
limited to authorized conversations; attachment metadata/URLs, other users'
proposal counts, private profiles and Request descriptions are not exposed.

### Message preview and unread amendment — 2026-11-05

- Every group returns `latestMessage: object | null` and `hasUnread: boolean`.
  A group with no published message (including proposal-only groups) returns
  `null` and `false`. Drafts/preparing/failed messages never contribute.
- `latestMessage` includes the message `id`, `conversationId`, `senderId`,
  `messageType` (TEXT/FILE/SYSTEM), `preview` and UTC `sentAt`. Per-conversation
  latest uses the highest published sequence; across conversations select by
  `sentAt DESC, message id DESC`. Sequence is never compared between chats.
- `preview` is plain text with whitespace normalized and at most 160 Unicode
  code points (a technical response bound). Empty FILE text uses `Đã gửi một tệp`;
  other empty text uses `Cập nhật cuộc trò chuyện`. No signed file URLs or storage
  fields are returned. Preview labels for structured client message formats are
  not decoded by this endpoint.
- `hasUnread` is true if any accessible conversation contains a published message
  from another sender with sequence greater than **this viewer's** read watermark.
  A missing watermark starts at zero. Outgoing messages do not clear earlier
  unread incoming messages. Reading Inbox never advances watermarks.
- Request summaries cover **every** participant conversation for selected groups,
  independent of child-chat pagination. Request ownership alone grants no access
  to other people's chats. Direct groups summarize their one authorized chat.
- Hydration enumerates participant IDs from PostgreSQL in batches of 100, then
  reads latest messages/read states from MongoDB outside PG transactions. Each
  Mongo batch uses a snapshot read and a five-second query bound; no per-chat
  client round trip is made. Both viewer grants/session are checked again
  after Mongo hydration. Cross-store/group pagination remains live, not a snapshot.
- Mongo failure/incomplete results return 503 instead of silently returning
  `null`/`false`. Proposal-only pages need no Mongo access. Existing counts,
  ordering, cursors and `lastActivityAt` are unchanged; proposal activity may be
  newer than `latestMessage.sentAt`.
- This is an additive response change. No new seed, ENV, PostgreSQL migration or
  Mongo index is required; reuse the configured Mongo replica set and existing
  chat publication/read-state indexes. Clients can use these fields directly
  instead of inferring unread from partially loaded chat history. Mobile source
  is outside this amendment's scope.

Counts are aggregated over all relevant PostgreSQL rows **before** group
pagination. Proposal and Conversation aggregates are separate so their join cannot
multiply the counts. Group activity is the latest viewer-related proposal or
accessible Conversation activity. Ordering is `(lastActivityAt DESC, group key
DESC)`, with an opaque viewer/order-scoped cursor. Namespaced keys prevent a
Request and direct Conversation sharing a UUID from colliding. Invalid/foreign
cursors return 400 `INVALID_CURSOR`.

Load a group's child chats with the additive filter:

`GET /api/v1/conversations?learningRequestId=<uuid>&limit=20&cursor=...`

This checks participant membership and orders by `lastActivityAt DESC, id DESC`.
Its cursor is scoped to the Request filter; group/flat/other-Request cursors are
not interchangeable. This summary amendment does not change their cursor scopes.

`GET /api/v1/proposals?direction=sent&learningRequestId=<uuid>&status=...`
now returns only the current proposer's history, with the existing status filter
and `createdAt DESC, id DESC` keyset pagination. It does not fetch the public Request detail
or require ownership. Missing/unrelated Request IDs produce an empty own-history
list. Received lists filtered by Request remain owner-only; nonowners get 404.

Proposal list/detail responses add `learningRequestTitle: string | null`, read in
batches through the Learning Requests owner contract. Related users retain the
title for closed/nonpublic Requests. Direct proposals return null. This also
applies to proposal projections returned by create/update/decision workflows.

## Client integration

- Use the grouped endpoint for titles, roles and complete counts; do not derive
  totals from a partially loaded proposal/chat page.
- Owners open received proposals; proposers open their own sent proposals.
  Pending proposals without chat stay available in Sent.
- The mobile wrapper in this checkout still rejects sent + learningRequestId and
  does not consume learningRequestTitle. Update that client separately to use
  the new backend contract. No mobile/frontend file is changed here.
- Groups are live pagination, not a frozen snapshot. Refresh page one on new chat
  or proposal events. Signed/private content continues to use existing APIs.

## Constitution and rollout

- Scope/modularity (1, 7): Conversations owns grouping and membership. Proposals
  exports a parameterized viewer-scoped aggregation projection. Learning Requests
  owns historical title access. Lightweight read modules avoid command/worker
  dependency cycles; no cross-module repositories or writes are introduced.
- Stores/transactions (2, 3, 8): membership/count reads run in PostgreSQL transactions;
  message/read-state hydration runs in Mongo outside those transactions.
  Mongo message state, delivery, financial state, audit and outbox are unchanged.
  Counts are derived on read. A minimal Conversation activity projection is maintained
  alongside delivery acknowledgement and rebuilt from published Mongo messages.
- Security/contracts (4, 5): live grants and viewer predicates, scoped cursors,
  DTO validation and Swagger; no public detail permission is bypassed.
- Verification (6): tests cover historical title privacy, sent/received ownership,
  counts across statuses, membership isolation, proposal-only groups, direct chats,
  cursor ties/collisions, route precedence and compatibility. See validation below.

No new ENV or seed is required. Apply `20261102235959_conversation_activity_guard`
and `20261103000000_inbox_activity` before
starting the new API/workers. After all old workers have stopped, run
`pnpm --filter api chat:backfill-activity` (or `node scripts/backfill-chat-activity.mjs`
in the built API container) before enabling the grouped Inbox in clients.
The backfill is bounded and safely rerunnable; it uses the configured application
PostgreSQL/MongoDB connections and never overwrites newer live activity.
New Conversations use creation time until a message is published.

### Recovery for the legacy Conversation trigger (2026-11-04)

The published Connections trigger rejected every Conversation UPDATE, including
the Inbox migration's initialization of existing rows. PostgreSQL reported
`Conversation membership is immutable`; Prisma then left the migration failed,
blocking subsequent starts before the API/Terminal became available.

The new guard migration deliberately sorts immediately before the published Inbox
migration. It permits changing only `last_activity_at`, preserves all other fields
(including nullable Request membership), and retains accepted-Proposal checks on
INSERT. The published Connections and Inbox migration files remain unchanged.

Deploy the fixed image normally; no container Terminal, extra ENV or seed is needed.
Under the existing per-database/schema release advisory lock, bootstrap checks for
exactly one unresolved failure: `20261103000000_inbox_activity`, with the known
guard error and the published migration checksum. It verifies the existing guard,
locks Conversations, replaces the guard and completes the activity column/backfill
and both indexes in one transaction. Existing non-NULL activity values are kept.
Only after commit does it invoke `prisma migrate resolve --applied` for this migration,
then resume normal migration deployment (including recording the new guard migration).
An interruption before resolve is retryable; no Prisma history rows are edited by
the recovery code. Unknown checksums, customized guards, incompatible columns/indexes
or other failed migrations are not automatically resolved. Normal Prisma deployment
continues to reject unrelated failures. Manual seed-only runs never trigger recovery.

After deployment, verify `Recovered Inbox activity migration blocked by the legacy
conversation guard`, `Release database steps completed`, readiness HTTP 200 and
successful chat delivery. Mongo history backfill above remains a separate rollout
step. Local verification does not establish recovery of the deployed database.

The original grouped-Inbox branch was based directly on dev and included only grouped-Inbox changes
and the necessary activity/read contracts. It excludes the earlier rate-limit,
flat-list ordering, sender-enrichment, Verification AI and AI design commits.
Flat Conversation and Proposal list ordering/cursors remain unchanged.
Production query plans and large-history latency remain deployment checks.

## Validation

Verified on 2026-11-03 against dev `6414a82c`:

- TypeScript (`tsc --noEmit`), Nest build, API ESLint and runtime-schema regeneration: passed.
- Connections: 38 tests, 34 passed, 0 failed, 4 skipped. Includes actual localhost HTTP
  routing/validation/pagination, historical title privacy, sent/received filters,
  chat-delivery retries and monotonic activity/backfill checks.
- Backend regression script: 263 tests, 262 passed, 0 failed, 1 skipped.
- Production aggregate SQL and the actual activity migration passed on isolated
  PostgreSQL 18.6 WASM (PGlite 0.5.15), installed outside the repository. Checked
  existing Conversation timestamp preservation, creation defaults and indexes;
  full historical counts, viewer membership, proposal-only groups, direct chats,
  namespace collisions and cursor timestamp ties.
- Five datastore checks remain skipped without explicit isolated test-store URLs,
  including the new PostgreSQL service test. WASM verification does not establish
  service integration, production query plans or load performance.
- No mobile code, production migration, seed or deployment has been executed.

## PR 68 Sonar remediation (2026-11-03)

The published baseline `c73bb88a` had five open findings: one Blocker
`plsql:DeleteOrUpdateWithoutWhereCheck` and four Minor `javascript:S9382`.
Reliability E was the only failing gate condition; Security/Maintainability were
A and duplication was 0%.

- `AaGh09DJ0fcjwubeKPmJ`: the new Inbox migration initializes only NULL activity
  values with creation time. This migration belongs to the unmerged PR and is
  absent from dev; no deployed migration was changed or executed by this task.
- `AaGh09DI0fcjwubeKPmI`: replace per-Conversation awaits with one parameterized
  `UPDATE ... FROM (VALUES ...)` per page. Validate the complete Mongo page before
  writing. Keep the newer-than-current predicate so live deliveries win races.
- The page unit reads PostgreSQL IDs, reads their Mongo summaries, validates and
  writes its bounded SQL batch before returning the next keyset ID. The outer
  page chain remains sequential and keeps at most one page in memory.
- Baseline `AaGh09DI0fcjwubeKPmH`, `AaGh084C0fcjwubeKPmF` and
  `AaGh084C0fcjwubeKPmG` concern dependent cursor iteration. Proposed disposition:
  Accepted. Pagination requires the previous response/cursor, including the test
  that verifies timestamp ties. These operations cannot be parallelized correctly.
  Source comments document the dependency; no rule suppression or NOSONAR was added.

Sequential dependent operations are an explicit exception in
[Sonar's S9382 rule](https://rules.sonarsource.com/javascript/RSPEC-9382/).
The page-processing refactor may relocate the remaining S9382 finding; use the
fresh issue key/line from the next analysis, not only this historical baseline.
Cloud dispositions have not been applied: the browser automation runtime is
unavailable in this session. This report does not claim those findings closed.

Validation for this revision includes actual bulk SQL, migration timestamp/default
preservation, monotonic/rerunnable backfill, all-or-nothing validation of each page,
and stopping before the next page after a write failure. The isolated PostgreSQL
WASM harness passed; real test-store execution remains separately gated by
TEST_DATABASE_URL/TEST_MONGODB_URI.

Local remediation checks passed: API typecheck, Nest build, ESLint and
`git diff --check`; Connections reports 40 tests, 36 passed, 0 failed and 4 skipped
without isolated test-store URLs. The actual migration, bulk UPDATE, rerun and
newer-activity preservation also passed on PostgreSQL 18.6 WASM. A fresh published
Sonar analysis is still required after the remediation commit is pushed.

## Conversation trigger recovery validation (2026-11-04)

- API typecheck, Nest build, ESLint, formatting and `git diff --check`: passed.
- Release/bootstrap: 18 tests passed, including recovery-before-migrate ordering,
  failure stopping deployment and seed-only isolation. File tests used a workspace
  cache directory because the Windows sandbox denied renaming its virtual TEMP files.
- Connections on a newly initialized, disposable native PostgreSQL 18 cluster:
  41 passed, 0 failed, 1 skipped (Mongo replica-set URL not supplied). Full published
  migrations, existing acceptance/feed journeys and populated-Conversation upgrade
  all passed. The old trigger is installed from the published Connections SQL in
  the regression fixture; a minimal table without that trigger cannot catch this bug.
- Additional Prisma CLI verification: 3 passed. Native `migrate deploy` reproduced
  P3018 and then P3009; recovery completed the DDL, actual `migrate resolve --applied`
  succeeded and another deploy recorded the earlier guard migration successfully.
- Fault cases verify checksum drift, unrelated/multiple failures, incompatible
  columns/indexes, transaction rollback, interruption before Prisma resolve,
  retry preserving newer activity, immutable identity updates and accepted-Proposal
  INSERT checks. Historical migration files are unchanged.
- Deployed recovery/readiness and cloud analysis remain unverified until the fixed
  revision is published and deployed. No application database was used for these tests.
