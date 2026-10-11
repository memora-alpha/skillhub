# Data Model: Kết nối

**Status**: Additive runtime schema/migration and Mongo repository/index script added through the existing schema generation flow. No migration has been deployed; real-store proof is pending in [validation](validation.md). Path/Schedule cards remain future owner contracts.

## Authoritative stores and owners

| Entity                    | Owner/store                       | Authority                                                                      |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Proposal                  | proposals/PostgreSQL              | Source, participants, suggestions, status/version/expiry                       |
| Conversation              | conversations/PostgreSQL          | Fixed two participants and accepted Proposal/source                            |
| Message                   | conversations/MongoDB             | Text/embedded attachments/card reference, immutable published content          |
| MessageStream             | conversations/MongoDB             | Technical committed publication sequence, not membership                       |
| ConversationReadState     | conversations/MongoDB             | Per-user monotonic read watermark                                              |
| ChatPublication           | conversations/PostgreSQL          | Technical send reservation/authorization/file binding/delivery status; no text |
| StoredFile                | storage/PostgreSQL + S3 bytes     | Current file safety, binding, generation and storage identity                  |
| Request/User/SharingSkill | Existing owner modules/PostgreSQL | Access only through owner contracts; do not duplicate authority                |

There is no Attachment collection/table: Mongo attachments embed server snapshots, referencing authoritative StoredFile by fileId. Conversation has A/B columns already; do not add a third participant mechanism.

SSE amendment adds technical PG `UserEventStream`/`UserEventDelivery` owned by application-events and Mongo `MongoEventIntent` owned by conversations. These store recipient-feed references/delivery intent, never duplicate chat text or authoritative membership. Full protocol: [SSE contract](contracts/sse.md).

## Proposal (existing model + additive fields)

- Existing: UUID id; sourceType LEARNING_REQUEST/DIRECT_SEARCH; nullable requestId; proposerId/recipientId/skillId; message VARCHAR(1000); candidateSlots JSONB default `[]`; optional duration SMALLINT, proposedCredit BIGINT units, initialSessionCount SMALLINT; expiresAt, status, createdAt.
- Planned: version integer default 1, updatedAt; terminalAt nullable; exchangeTypeHint nullable TWO_WAY/ONE_WAY; immutable targetSharingSkillId nullable FK SharingSkill, required for DIRECT_SEARCH and null for LEARNING_REQUEST. Persist exact direct target so archive/recreate cannot silently retarget invitation.
- New creations require nonnull expiresAt; legacy PENDING/null-expiry requires explicit migration policy, no invented backfill.
- proposedCredit integer **hundredths** for this suggestion field only; public value canonical decimal string. `20.00` → `2000`; max `999999999999` units. Nonnull old values require preflight before enabling this interpretation.
- Source checks: LEARNING_REQUEST requires requestId, DIRECT_SEARCH requires null requestId; proposer != recipient. Request owner/skill association validated via locked owner contract.
- Message length 10–1000 after safe normalization; slots array count ≤5 with `{startAt,endAt}` UTC/start<end/future at write; duration null or 60–180; count null or ≥1/≤configured SMALLINT max. Supplied price requires hint and matching threshold; no floating point.
- Partial unique PENDING `(request_id, proposer_id)` when request source; partial unique ACCEPTED `request_id` when nonnull; proposed direct PENDING `(proposer_id,recipient_id,skill_id)` when direct.
- Indexes: recipient/status/createdAt/id, proposer/status/createdAt/id; expiry/status/id for bounded sweeper.

| From     | Operation            | To                   | Actor/preconditions                                                                                |
| -------- | -------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| PENDING  | Update hints/message | PENDING, version++   | Proposer, expectedVersion, unexpired source/eligibility valid; immutable source/participants/skill |
| PENDING  | Accept               | ACCEPTED, version++  | Recipient, expectedVersion, unexpired, live accounts/eligibility; Request OPEN if present          |
| PENDING  | Reject               | REJECTED, version++  | Recipient, expectedVersion, not expired; source need not remain OPEN                               |
| PENDING  | Withdraw             | WITHDRAWN, version++ | Proposer, expectedVersion, not expired; source need not remain OPEN                                |
| PENDING  | Expire               | EXPIRED, version++   | System, DB now >= expiresAt, CAS under lock                                                        |
| Terminal | Same command replay  | Same                 | Live auth/membership then stable result; different operation conflict                              |

Expired PENDING cannot mutate even before worker transitions. Repeated failed commands must not inadvertently commit an expiry change inside a transaction that then throws. Worker performs durable transition separately; request can return `PROPOSAL_EXPIRED` based on timestamp meanwhile.

## Conversation (existing)

UUID id, unique proposalId, optional requestId, participantAId, participantBId, createdAt. Define A=proposer, B=recipient consistently; this is identity ordering, not teaching roles. Immutable participants, A != B. Add partial unique requestId when nonnull for one negotiation per Request; preflight current data.

Create only via `createForAcceptedProposal(tx,...)` from the atomic accept command. Consistency checks ensure accepted Proposal/source/participants match. Do not let client create arbitrary rooms. List via participant indexes and createdAt/id cursor; no dependency on Mongo availability to complete accept/list relational metadata.

## ChatPublication (new technical PostgreSQL model)

| Field                                 | Rule                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id / messageId                        | Same stable server UUID; primary/unique                                                                                                                       |
| conversationId / senderId             | FKs; sender must be A or B via conversations owner check                                                                                                      |
| clientMessageId                       | Client UUID; unique `(conversationId,senderId,clientMessageId)`                                                                                               |
| commandDigest                         | Server digest of normalized text + ordered fileIds + command version; no text stored                                                                          |
| draftDigest / draftFormatVersion      | Nullable PREPARING; required COMMITTED/DELIVERED. Digest of full normalized content + server attachment manifest and format version; never the content itself |
| deliveredEventId                      | Stable server UUID reserved with receipt, unique; reused for delivery notification event                                                                      |
| state                                 | PREPARING → COMMITTED → DELIVERED; PREPARING → CANCELLED for approved cleanup only                                                                            |
| attachmentFileIds                     | Technical immutable file references, not authoritative attachment metadata                                                                                    |
| createdAt / committedAt / deliveredAt | UTC; nullable until state requires it                                                                                                                         |
| publishedSequence                     | Nullable BIGINT until delivered; JSON decimal string                                                                                                          |
| failureCode / attempt metadata        | Sanitized diagnostics; no content or provider secrets                                                                                                         |

Receipt state remains COMMITTED on delivery failure; outbox retains failed retry status, so business publication is not falsely cancelled. PREPARING is never visible to other participant. No auto-timeout until recovery/retention policy approved. Reject new sends with same identity/different digest even after publication; do not TTL away uniqueness without a separately approved replay horizon/tombstone.

## Message (new Mongo schema)

- `_id`: server message UUID string matching receipt for user messages; system cards deterministic event identity. `conversationId` UUID application-validated against PG; `senderId` UUID nullable only for trusted system event.
- `clientMessageId`, `commandDigest`, `draftDigest`, `draftFormatVersion` for user sends; `eventId` only for business events. Full draft digest seals content/server file manifest; unique partial identity indexes so null event/client fields do not collide.
- `state`: DRAFT/PUBLISHED. DRAFT never returned in history and has no sequence/sentAt/readAt.
- `messageText`: sanitized plain text, 1–2000 if present; file-only allowed; no empty text+empty array. `messageType`: client only TEXT/FILE inferred server-side. Other types allowlisted server events only.
- `attachments`: embedded array `{attachmentId,fileId,generation,mimeType,storageKey,fileSizeBytes,scanStatus,checksum}`; attachmentId unique within message; metadata server-only; current storage state remains authoritative. Public response excludes storageKey/checksum/internal scanner metadata.
- `objectType/objectId/objectVersion`: nullable for user text/file; required/validated for structured cards. No arbitrary client payload. Immutable published version reference.
- `sequence`: integer BSON Long, absent for DRAFT, unique `(conversationId,sequence)` for PUBLISHED; serialize as decimal string, no JS precision loss.
- `sentAt`: publication time, assigned once by server in publication transaction; `createdAt` is internal draft time. Published content/time/sequence immutable.
- `readAt`: recipient read timestamp projection may be derived from read state; don't create two conflicting authorities. With exactly two participants, recipient is opposite sender. For system messages use viewer-specific read state.

Indexes: `_id` unique; `(conversationId,senderId,clientMessageId)` unique partial user identity; eventId unique partial business events; `(conversationId,sequence)` unique partial published sequence. No TTL Message/draft index before retention approved. Create indexes explicitly before release; production `autoIndex` is already false.

## MessageStream and ConversationReadState (Mongo technical documents)

MessageStream `_id=conversationId`, next/last sequence BSON Long, no membership/status copied from PG. Publication transaction reads existing message; if already PUBLISHED return unchanged. Otherwise atomically increment stream and publish DRAFT with next sequence/sentAt. Write conflicts/retries must recheck published status before increment. An abort rolls back both; only committed published messages advance sequence.

ReadState unique `(conversationId,userId)`, `lastReadSequence`, `lastReadAt`. Server validates target PUBLISHED message and membership, then monotonically advances with `$max`/conditional update; timestamp changes only for advancement. Never trust arbitrary numeric sequence beyond an existing message. Derive unread count from published messages by other sender above watermark; no increment-only counter that drifts on retry.

For each real advancement, increment read-state revision and persist a MongoEventIntent in the same Mongo-local transaction. Intent has stable eventId, type/version, Conversation/reader/watermark/readAt references, state and retry metadata; unique eventId and read revision identity. No-op/older read commands produce no new intent. Worker appends user SSE feed idempotently in PG, then acknowledges Mongo intent; a crash between stores reuses eventId. No in-memory-only emit may replace this durable bridge.

## Technical SSE recipient feed (PostgreSQL)

- `UserEventStream`: PK userId, epoch UUID, lastSequence BIGINT, firstRetainedSequence BIGINT. Counter lock acquired after business/file locks; multiple recipient stream rows locked by sorted userId. Allocate sequence + insert event in same PG transaction, avoiding commit-order holes from global ID allocation.
- `UserEventDelivery`: userId, sequence BIGINT, eventId UUID, type/version, small safe reference payload, occurredAt. Unique `(userId,sequence)` and `(userId,eventId)`, index for ordered bounded replay/cleanup. Feed payload never stores Message text/private object keys; owner state remains authoritative.
- PG changes append through event-writer contract inside their transaction or through an idempotent committed-outbox consumer. Notification create/read changes integrate here, including existing inbox routes. Chat events append only after verifying published Mongo Message; read events use durable MongoEventIntent bridge. Storage status events target CHAT uploader.
- Replay cursors bind user/epoch/sequence using validated signing configuration; this sequence is distinct from Message.sequence. Delivery is at-least-once. Revalidate live actor/resource permissions before emit/replay; forbidden rows can advance via safe checkpoint without private identifiers.
- Retention trims only contiguous prefix under counter lock and updates replay floor atomically. Operational replay window/row caps must be configured; expired cursors trigger explicit resync, never chat/file deletion. No stream connection holds a database transaction open.
- Persist wakeup outbox with feed append. Redis Pub/Sub carries only wakeup references; all instances fetch ordered rows from PG. Dedicated Redis subscriber and heartbeat catch-up cover missed signals; local buffers are bounded and disposable.

## Publication saga and recovery

1. **Reserve PG**: Live principal/permission/membership, validated command/digest, stable PREPARING receipt. Same key/digest returns existing identity; different digest conflicts. No payload/file binding yet.
2. **Persist Mongo DRAFT**: Upsert immutable content against receipt ID/digest with acknowledged durable write. Before finalizing, re-read draft and validate identity/digest; input file metadata not trusted.
3. **Commit PG intent**: Read immutable Mongo draft outside PG tx, compute full draftDigest/version. In PG tx recheck live principal/permission/membership; lock receipt then files in common order, compare server draft manifest against locked StoredFile generation/MIME/size/checksum and bind uploader-owned READY/CLEAN CHAT files. Seal digest/version, state COMMITTED, outbox `chat.message.publish` references messageId/conversationId. Atomic with binding. No Mongo/S3 call inside tx.
4. **Publish Mongo**: Consumer loads committed receipt then draft; validates identity/digest/file snapshots prepared by server; Mongo-local transaction assigns sequence/publishes. No PG transaction held while calling Mongo.
5. **Acknowledge PG**: CAS COMMITTED→DELIVERED with sequence and enqueue reference-only notification using stable deliveredEventId in the same transaction, only when CAS wins. If already DELIVERED, verify original sequence and do not create another event. Dispatcher ack last. Crash after Mongo commit replays unchanged message and repairs receipt/notification without duplicate.

| Crash/failure point                       | Recovery                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| After reservation, before draft           | PREPARING; client retry supplies same immutable payload; no delivered response or file binding                         |
| After draft, before intent commit         | Retry finalization after live auth; draft remains hidden and files unbound                                             |
| After intent commit, before publish       | Durable outbox/worker recovers from existing draft; pending response only                                              |
| After Mongo commit, before PG receipt/ack | Idempotent Mongo lookup repairs PG delivered receipt and notification                                                  |
| Mongo unavailable                         | Proposal accept unaffected; sends remain pending/error, retry records retained                                         |
| Draft missing with COMMITTED receipt      | Retained integrity failure; no fabricated text, no automatic unbind/delete                                             |
| Account revoked after intent commit       | Already authorized committed send may finish; all later reads/downloads/replays use live auth; no new sends authorized |

Cleanup must coordinate via receipt tombstone. It can cancel PREPARING under receipt lock only; finalization rechecks CANCELLED. COMMITTED cannot be cancelled by orphan cleanup, so publisher can finish without a cross-store lock. Draft deletion after a PREPARING cancellation must also cover a late draft upsert; reconciliation may delete cancelled drafts again. Never delete a COMMITTED/DELIVERED draft/message/file as orphan.

## Migration and rollout gates

- Additive migration with preflight pending duplicates, accepted/request collisions, mismatched Conversation source/participants, legacy expiry and proposedCredit interpretation. Report IDs; do not choose a winner/delete history automatically.
- Preserve existing runtime-v3 migrations and catalog diagrams. Update generator source/technical overlays so regenerate does not drop new fields/models/index definitions. SQL-only partial uniques/CHECKs require durable migration definitions/tests.
- Deploy PG migration and Mongo indexes before enabling handlers; verify replica-set transaction capability. No request fallback that silently disables constraints or uses standalone without sequence atomicity.
- Forward-only feature rollout with config activation gates; disable new creates/sends if prerequisites absent while existing reads remain protected. No destructive automated rollback of published history.
