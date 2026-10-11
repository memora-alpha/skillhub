# Research: Kết nối — Proposal và Chat

**Date**: 2026-10-09 planning baseline; implementation amendment 2026-10-10. **Method**: SRS v1.6 extraction and source inspection, followed by scoped implementation and checks recorded in [validation](validation.md). The source inventory below is historical baseline, not current implementation status.

## Implementation decisions

- User-approved limits in [policies.md](policies.md) resolve G-01/02/03/05. G-04 optional hint bounds remain field-specific configuration gates; G-06 and external G-07 remain production gates.
- Send quota enforcement uses PostgreSQL rolling counts under sorted User/Conversation locks. This shares enforcement across instances and allocates quota with durable proposal/receipt identity; an idempotent retry does not consume a new slot. Global API IP throttling remains Redis-owned.
- Notification INSERT/read_at transitions and CHAT StoredFile state changes append public references using PostgreSQL owner triggers. This covers existing verification/LR/notification paths atomically without duplicating adapters at every writer. Duplicate/no-op read creates no new logical event. Generic in-app connection/chat notification creation goes through Notifications' exported owner service.
- Chat delivery CAS and notification/feed append share one PG transaction after verified Mongo publication. Only `chat.message.publish` and `application.events.wakeup` are new outbox publisher types; proposal/notification/feed work commits atomically without an extra internal delivery queue.
- Compose now declares rs0 and explicit index setup is `scripts/migrate-chat.mjs`. This configuration does not establish transaction/provider readiness; isolated real-store suites remain pending.
- SSE controllers use Express streaming for pre-header JSON errors and write/drain bounds. No PG transaction spans transport writes. Reference payload schemas reject private fields and require UUID/Long strings. Feed-prefix trimming preserves wakeup outbox dedupe receipts; business purge is disabled.

## 1. Business source and scope

**Decision**: SRS `../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` is authoritative. FR-PP-01…06/PP-001…005 define request proposals; FR-SK-07 and 18.11 define direct search invitations; BR-12 says Accept opens negotiation only. BR-29 and CHAT-001…006 define chat/files/privacy/cards. FR-NTF-01 is Should. NFR-PERF-01/02 set P95 ≤2s and pagination.

**Rationale**: Older history paragraphs in the DOCX still describe obsolete per-session settlement. Only current v1.6 rules apply. Neither schema presence nor README breakdown proves implementation.

**Alternatives considered**: Include Path/Schedule/Credit now; rejected because user requested proposal/chat and those have separate owners/versioned confirmation workflows. Structured-message consumption contract is included; producer implementation stays Pending.

## 2. Actual source inventory

Paths below are relative to `services/api` and were checked at planning baseline `4596b79`.

| Source                                                                                     | Exists now                                                                    | Consequence                                                                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/app.module.ts`, `src/modules/`                                                        | No proposals/conversations module                                             | New use cases/controllers required; no feature-runtime claim                                                               |
| `prisma/schema.prisma` Proposal/Conversation                                               | Domain tables/models, unique Conversation.proposalId; A/B columns             | Reuse rather than introduce redundant participant join table; missing version/CAS and match constraints                    |
| `prisma/migrations/20261007000000_runtime_v3/migration.sql`                                | Tables/FKs/basic indexes                                                      | Migration deployment remains separate; add constraints with preflight                                                      |
| `src/modules/learning-requests/application/services/learning-request-lifecycle.service.ts` | `lockForProposal`, `beginNegotiation`, `markMatched`, `markClosed`            | Request owner participates in caller tx; OPEN/expiry/self guard exists                                                     |
| `src/modules/learning-requests/learning-requests.module.ts`                                | Five readers bound to `UnavailableLearningRequestDependencies`                | Catalog, eligibility, lock, public owner and matching can return 503; do not bypass                                        |
| `src/modules/sharing-skills/application/sharing-skills.service.ts`                         | `assertTeacherEligible(tx,...)`, exported service                             | Useful owner API, but repository eligibility does not lock or require visibility                                           |
| `src/modules/users/application/services/skill-actor.service.ts`                            | Sorted user locks, live session, permission/restriction checks                | Extend via users-owned general contract; don't assume its skill-specific restriction semantics cover every proposal action |
| `src/modules/auth/application/services/sessions.service.ts`                                | `assertLive` account/session/security/grants                                  | Use for replay as well as first request; JWT alone insufficient                                                            |
| `src/shared/authorization/permission.catalog.ts`                                           | `proposal:create`, `conversation:read:participant`                            | Add explicit remaining actions/resolvers/seed grants                                                                       |
| `src/infrastructure/database/database.module.ts`                                           | Mongoose connection only                                                      | No Message schema/repository/index/read state yet                                                                          |
| `src/infrastructure/storage/file-storage.service.ts`, `file-policy.ts`                     | CHAT streaming cap 15.000.000, MIME/hash/quarantine/scan/download-policy hook | Reuse bytes/scan, don't duplicate provider logic                                                                           |
| `src/infrastructure/storage/file-attachment.service.ts`                                    | `status`/`attachReady` hard-code EVIDENCE/10 MB                               | CHAT binding/status is new work; don't weaken Evidence policy                                                              |
| `src/infrastructure/database/transaction-runner.ts`                                        | Serializable retry, maximum three attempts                                    | PG deadlock/serialization retries cannot contain Mongo/S3 side effects                                                     |
| `src/infrastructure/idempotency/idempotency.service.ts`                                    | Fingerprint and authorization on replay, minimal reference results            | Reuse Proposal commands; message saga needs its own durable identity                                                       |
| `src/infrastructure/events/`                                                               | Dispatcher/registry/consumer/outbox                                           | PG receipt atomicity does not cover Mongo writes                                                                           |
| `src/modules/notifications/notifications.module.ts`                                        | Inbox + rejection publisher; separate skill notification module exists        | Register connections event handlers deliberately; avoid duplicate registry keys                                            |

## 3. Proposal identity, duplicate prevention and currency suggestions

**Decision**: One Proposal model for both source types. For Request, derive recipient/skill server-side. For direct, persist immutable targetSharingSkillId of recipient's visible active Sharing Skill; recheck that exact target, never an archive/recreated substitute. PP-001's proposer teacher requirement applies to Request offers; direct initiator can be learner under FR-SK-07. Recheck current source/eligibility on accept; compatible Request edits are allowed unless caller supplies an obsolete expectedRequestVersion.

**Rationale**: Requiring learners to already own the skill they search for would contradict direct contact user journey. Direct invitation is not a teacher/learner or TWO_WAY/ONE_WAY commitment.

**Alternatives considered**: Separate ExchangeInvitation table; unnecessary duplication. Treat all initiators as teacher; rejected for search journey.

**Decision**: Partial unique PENDING `(request_id, proposer_id)`; partial unique ACCEPTED `request_id`; unique Conversation source Request when nonnull; unique Conversation.proposalId. Direct PENDING directed `(proposer_id, recipient_id, skill_id)` uniqueness is a proposed narrow duplicate guard, not a cooldown/rate policy. No unique unordered user pair and no merging unrelated Conversations.

**Rationale**: OPEN→NEGOTIATING is the source reservation; DB constraints are defense against races/manual bugs. Sibling PENDING remain historical/nonacceptible, not auto-REJECTED. No reopen path is invented.

**Decision**: Add optional `exchangeTypeHint`, required with proposedCredit, because SRS has conditional thresholds but current Proposal lacks a type discriminator. It remains a hint, never authoritative agreement type. Decimal string input maps exactly to BIGINT hundredths (1 Credit = 100 suggestion units); max decimal(12,2) = `9999999999.99`. Avoid JS floating point. Existing other BIGINT domain values are untouched.

**Rationale**: SRS decimal(12,2) and v3 BIGINT units coexist via explicit scale. Foundation's integer-unit principle is preserved. No migration assumes existing proposedCredit values already use this scale; nonnull existing suggestions require preflight/operator resolution.

**Alternatives considered**: Floating point or silently treating 20 Credit as 20 scaled units; rejected. Financial schema migration is out of scope.

## 4. Accept and module ownership

**Decision**: Single Serializable PG transaction calls users eligibility/live auth, sharing eligibility, LR lifecycle, conversations creation, proposals state change, audit and outbox. Common lock order is in plan/internal contract. No external operations inside tx. CAS/version and unique indexes settle races.

**Rationale**: Request status belongs to LR; Conversation belongs to conversations. Existing export of LR repository does not authorize proposal code to write it directly. A transient retry must not publish effects from a rolled-back attempt.

**Alternatives considered**: Sequential independent transactions or Mongo-created Conversation; violate accepted ownership/atomicity. Accept creates draft LearningPath; rejected by BR-12 and requested scope.

## 5. Transport, publication ordering and read state

**Decision (amended by user 2026-10-09)**: HTTP commands/history + shared SSE live stream for chat, notification and application events. Durable per-user PG event feed supports Last-Event-ID replay across API instances; Redis Pub/Sub is wakeup transport with server-side catch-up, not the event source of record. Earlier forward-polling baseline is superseded. Presence/typing stays outside scope. Mongo owns Message/DRAFT; PG receipt/feed stores references, never message text or a second authoritative attachment document.

**Decision**: Reserve a stable receipt/message ID in PG before creating DRAFT; persist DRAFT; finalize PG publication intent/file binding/outbox; worker publishes DRAFT in a Mongo-local transaction with stream counter. Reply `202` while durable processing is pending; `201` only when publication is verified. Replay returns same ID; different content same key conflicts. See data-model for state machine.

**Rationale**: PG receipt plus durable Mongo DRAFT makes the boundary recoverable without putting chat text in PG/outbox. Sequence assigned atomically at publication avoids late-recovered messages falling behind a reconnect cursor. A read watermark is safe only against committed publication sequence.

**Alternatives considered**: Mongo insert followed by PG attach can expose unsafe file; PG bind followed by nondurable payload loses autonomous recovery; timestamp-only live cursors can skip late messages; distributed tx rejected. SSE uses existing API rather than a separate realtime service; WebSocket/Socket.IO and primary client polling are excluded by the explicit transport decision.

Mongo transactions require a replica set; the planning baseline's standalone Compose could not satisfy this design. Implementation now declares rs0, but runtime transaction readiness is still unverified. Session-bound operations run sequentially. Sources: [MongoDB transaction production considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/), [Mongoose 8 connection transaction API](<https://mongoosejs.com/docs/8.x/docs/api/connection.html#Connection.prototype.transaction()>).

## 6. Files and delivery

**Decision**: Storage-owned CHAT status/bind/download functions enforce uploader/purpose/CLEAN/generation/cap and stable message binding. Outbox contains references ≤existing 4096-character limit; Mongo consumer upserts on stable messageId/eventId before ack. PG `OutboxConsumer.processOnce` is used only for PG-only notification work, never as cross-store atomicity proof.

**Rationale**: Current Evidence-only attach service cannot bind CHAT files. File bytes stay S3; authoritative StoredFile state is rechecked on download even if Message snapshot says CLEAN.

**Decision**: Retry/backoff/failure retention reuse dispatcher policy (8 attempts/cycle, replayable failure). Reconcile COMMITTED/DELIVERED receipts with Mongo. Orphan deletion disabled until retention approved; any later cleanup uses PG receipt tombstone/locks before Mongo/S3 delete. No provider call inside PG tx.

**Alternatives considered**: Put long message/attachments in PG outbox payload; violates content ownership/privacy and payload limit. TTL-index deletion of Mongo drafts/messages independently; races binding/publication and retention.

## 7. Open product decisions and activation gates

These are intentionally unanswered business values, not hidden defaults. Test fixtures must use explicitly named test policies; fixtures are not production configuration.

| Gate                      | Needs decision                                                                                                   | Effect until decided                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| G-01 Proposal expiry      | Approved 7 days; update preserves expiry                                                                         | Implemented default                                                                  |
| G-02 Direct contact/abuse | Approved 10 proposals/hour/User, 50/day; direct pair/skill cooldown 24h                                          | Implemented rolling PG enforcement; global API IP throttle retained                  |
| G-03 Chat rate            | Approved 30/min/User and 120/min/Conversation                                                                    | Implemented rolling PG enforcement                                                   |
| G-04 Optional hints       | initialSessionCount max ≤32767; ONE_WAY suggestion min/max                                                       | Omit optional field or return policy unavailable when supplied                       |
| G-05 Files per message    | Approved 5 files, 15,000,000 bytes/file and 50,000,000 total                                                     | Implemented manifest/send caps                                                       |
| G-06 Retention/moderation | Chat/file/draft/receipt retention, legal/case holds, deletion, report-message workflow, case-scoped staff access | No automatic purge or staff browsing; production gate per SRS 18.38                  |
| G-07 Notifications        | Production in-app/email/push and privacy behavior                                                                | Plan implements existing in-app adapter; external channels disabled until configured |

Assumptions needing review before expanding scope: direct recipient owns searched skill; no reopen/end-negotiation; Request cancellation retains chat; sender cannot edit/delete published Message. They are explicit proposed boundaries, not SRS facts.

## Phase 0 outcome

### SSE amendment evidence and decisions

Source inspection confirmed existing notification list/read commands already use PG transactions, and RedisService is a command connection with lifecycle hooks; no SSE/feed implementation exists. Planned adapters add atomic event append to existing notification create/read and storage scan changes. Dedicated `duplicate()` Redis subscriber avoids converting the shared command connection into Pub/Sub mode.

**Decision**: Small allowlisted reference events, signed user-feed cursor, connect-before-snapshot initial sync, Last-Event-ID replay, current-access projection, token expiry close, bounded buffers/connection leases and explicit retention-gap reset. PG counters allocate event sequence under lock in the append transaction; raw BIGSERIAL is not safe commit-order replay. Mongo read changes need their own durable local event intent before PG bridge, unlike PG-only notification changes.

**Rationale**: One SSE endpoint multiplexes chat/notification/current owner events without another service or exposing raw private outbox payloads. Feed replay retention is an operational cache policy separate from business chat/file retention. Lost Redis wakeups are covered by server-side durable-feed catch-up; clients don't need steady polling.

**Alternatives considered**: Pub/Sub-only streams lose events while offline; competing consumer groups do not fan out to clients on every API instance; per-connection process-local event IDs cannot resume on another instance. Native EventSource with JWT in query leaks credentials; use a header-capable fetch SSE client. No frontend code is added by planning.

Protocol/framework facts checked against primary sources: [WHATWG SSE standard](https://html.spec.whatwg.org/multipage/server-sent-events.html), [NestJS SSE](https://docs.nestjs.com/techniques/server-sent-events), [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/). Full behavior, event allowlist and verification gates are in [SSE contract](contracts/sse.md).

Technical choices resolved and constitution-compliant. Product values and real-owner/environment integrations remain named activation/release gates. Proceed to design and later task generation; do not call this feature implemented or production-ready.
