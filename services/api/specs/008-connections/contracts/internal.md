# Internal Contracts and Delivery: Kết nối

**Status**: Implemented core owner contracts; future card signatures below remain design-only. All owners remain within `services/api`; provider proof is recorded in [validation](../validation.md).

Actual exports: `SkillActorService.require/assertConnectionParty`, `SharingSkillsService.assertTeacherEligible/connectionTarget`, `LearningRequestLifecycleService.proposalSource/lockForProposal/beginNegotiation`, `ConversationLifecycleService.openFromAccepted/readForProposal`, `ConversationAccessService.require`, `ConnectionNotificationService.create/createChat`, `FileAttachmentService.chatStatus/chatManifest/assertBoundReady`, `ApplicationEventsService.append/lockRecipients`. Illustrative names below describe responsibility; source exports govern integration. `OwnerChatCardReader` is a future contract only, with no Path/Schedule publisher registered.

Existing notification create/read and CHAT file status producers are covered by owner SQL triggers in the Connections migration. Notification insert/read transition and reference feed/wakeup commit atomically. Proposals and verified chat delivery call Notifications' exported owner service inside their transaction. Acceptance calls Conversations' owner service; no foreign business writes are performed by Proposals. Application-events only reads foreign membership/ownership references for the public-feed access projection.

User amendment 2026-10-09: server→client chat/notification/application events use shared SSE. See [SSE contract](sse.md) for event allowlist/recipient replay/auth. Internal outbox remains durable module delivery; do not expose it directly as the public stream.

## Existing contracts to reuse

- `LearningRequestLifecycleService.lockForProposal(tx,requestId,proposerId)` returns locked OPEN/unexpired source owner/skill/verified requirement/version; `beginNegotiation(tx,requestId,expectedVersion)` updates via CAS. `markMatched` is for future schedule lock, not Accept.
- `SharingSkillsService.assertTeacherEligible(tx,{userId,skillId,verifiedRequired})` needs lock-safe extension; current method is read-only eligibility and does not require visibility.
- `SessionsService.assertLive(tx,principal)` revalidates account/session/security/grants. User locks use `lockUsers`, sorted IDs.
- `TransactionRunner`, `IdempotencyService`, `OutboxWriter/registry/dispatcher`, `FileStorageService` retain their current boundaries. Existing `FileAttachmentService` is Evidence-specific and must not be used unchanged for CHAT.

## Proposed owner exports

| Owner          | Exported capability                                                           | Contract responsibility                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| users          | `requireConnectionActor(tx,principal,action,otherUserIds)`                    | Sorted locks; live actor; explicit USER permission; active recipient for proposal create/accept; action-scoped restrictions via DB time |
| users          | `assertAccountsActive(tx,userIds)`                                            | No forged recipient session; accounts active within caller tx                                                                           |
| users          | `assertNewActivityAllowed(tx,userId,action)`                                  | Honor persisted restriction scope; no local reputation-derived penalty or broad read prohibition                                        |
| sharing-skills | `assertTeacherEligibleLocked(tx,...)`                                         | Lock catalog/SharingSkill before LR; active/nonarchived/VERIFIED as required                                                            |
| sharing-skills | `resolvePublicInvitationTarget(tx,sharingSkillId)`                            | Resolve/lock visible active skill+recipient; recheck visibility at direct accept                                                        |
| LR             | Existing lifecycle + owner readers                                            | Request-only state writes; bridge catalog/public owner/matching/eligibility through exported application contracts                      |
| conversations  | `createForAcceptedProposal(tx,input)`                                         | One room/proposal, same parties/source, unique Request; no nested tx                                                                    |
| conversations  | `assertParticipant(tx,principal,conversationId,action)`                       | Live role/permission/account and A/B membership; usable by storage/HTTP/replay                                                          |
| storage        | `chatStatus(actor,fileId)` / `bindChatReady(tx,actor,fileIds,messageBinding)` | CHAT purpose/uploader, READY/CLEAN/generation/size; sorted locks and atomic immutable binding                                           |
| storage        | `assertChatBoundReady(tx,fileId,messageBinding)`                              | Download/recovery checks current state, not Mongo's snapshot verdict                                                                    |
| notifications  | `deliverConnectionNotification(tx,eventReference)`                            | PG-only idempotent inbox work; privacy-safe content; separate channels later                                                            |
| conversations  | `consumeStructuredEvent(event)`                                               | Trusted allowlist/version contract, dedupe/counter+Message transaction in Mongo                                                         |

Users owns restriction vocabulary. Proposal create maps to persisted `proposal:create`; accept/send have explicit actions, not an inferred mapping from reputation score. Existing `ALL` and new-activity scopes must be reconciled in users contract/tests so restrictions do not unexpectedly block viewing or attending existing sessions. A peer account lock alone does not revoke the other participant's history access; each client action checks its own live actor, with both accounts ACTIVE required for new connection create/accept. Missing owner adapters remain 503, never a fake always-eligible reader.

Do not expose foreign Prisma repositories to proposal/chat use cases. Sharing/identity service extensions should be minimal owner-side methods; no empty abstract layer purely for naming.

## Atomic accept contract

1. Nonlocking read locates immutable party/skill/Request/exact direct SharingSkill IDs; it does not authorize.
2. `IdempotencyService.execute` invokes authorization before work: authorization locks both account UUIDs sorted from its first acquisition and checks live actor/accounts/grants/restrictions. Never lock principal alone then add recipient later.
3. Work locks source Request via LR `lockForProposal` if present, then sharing owner locks catalog/skill and checks eligibility (direct resolves persisted targetSharingSkillId). Lock Proposal; compare expectedVersion/PENDING/expiry with DB clock and revalidate immutable IDs after locks. Current-source revalidation is authoritative; edits still eligible may proceed unless caller supplied stale expectedRequestVersion.
4. For Request source invoke `beginNegotiation` with currently locked source version. Optional displayed expectedRequestVersion rejects stale UI snapshot if supplied.
5. Proposal CAS to ACCEPTED; conversations owner inserts room; audit append and reference-only `proposal.accepted` outbox; command result stores IDs/version, not private body.
6. Commit then hydrate response after live access. On unique conflict normalize state conflict; serializable/deadlock retry only via existing bounded runner.

Lock order: users → Request (if any) → catalog/SharingSkill → Proposal → Conversation → receipt → StoredFile, sorted within each group. This preserves LR edit/publish's existing Request-before-catalog order. Skills-only paths skip Request; no acquiring users/Request after catalog locks. Verify every new owner adapter against existing archive/revoke/LR edit/publish/cancel and future final-lock; provider/Mongo calls outside PG tx. No hold/path/schedule/session operations. One Request winner is defended by status, CAS and partial uniques.

Expiry worker locates bounded candidate IDs without long locks, then locks Request (if needed) before Proposal, rechecks PENDING/version/DB clock, and CASes EXPIRED. It never reopens Request or expires accepted Conversation. Reject/withdraw do not require Request OPEN, but require still-unexpired PENDING and current actor authority.

## User-message saga contract

See [data model](../data-model.md) for PREPARING/COMMITTED/DELIVERED state and crash table.

Reserve transaction validates command and writes identity+digest only. Same identity finds receipt; callers reauthorize before exposing it. Draft persistence is Mongo outside PG tx; content is immutable and can only be finalized against matching receipt/digest. Internal normalized snapshot includes server file metadata; public input does not determine it.

Before intent commit, read immutable Mongo draft and compute full `draftDigest` including content and prepared attachment manifest. PG finalization stores this digest (not content), locks/rechecks StoredFile snapshots against generation/MIME/size/checksum and uploader/purpose, then binds files + changes receipt COMMITTED + writes `chat.message.publish` atomically. Snapshot drift aborts; retry must not mutate an already sealed draft. Missing/changed draft is an integrity error rather than a new message identity. No Mongo call occurs inside finalization tx.

Worker requires COMMITTED/DELIVERED receipt, loads the exact sealed draft, compares draftDigest and uses Mongo transaction with sequential session-bound operations:

1. If Message already PUBLISHED with same identity/digest, return original sequence/sentAt.
2. If DRAFT, increment technical per-Conversation stream counter, publish it with that sequence/sentAt and server attachment snapshot in the same transaction.
3. Never publish a PREPARING/CANCELLED receipt; COMMITTED is irreversible by orphan cleanup. Content never gets another sequence on duplicate send/event.

After Mongo acknowledgement, PG tx CASes receipt COMMITTED→DELIVERED and, only if CAS wins, creates the generic in-app notification plus `chat.message.created` participant feed and `chat.delivery.updated` sender feed using the receipt's stable deliveredEventId. No extra `chat.message.delivered` outbox publisher is registered. Outbox ack follows. Replay of DELIVERED verifies the original published message and creates no new event. Receipt DELIVERED cannot synthesize a missing Mongo Message.

Draft cleanup is disabled until retention policy. A later cleanup may cancel PREPARING under PG locks, then remove draft; late draft upsert against cancelled receipt is hidden and cleaned on reconciliation. It must never delete COMMITTED payload/file. Persisted authorized send can finish after account lock; any subsequent client reads/replay/download still reauthorize live.

## Event registry and payload contracts

Reference payloads use current foundation OutboxMessage `{eventId,type,version,payload,correlationId}`. Payload max existing 4096 serialized characters; no chat text, signed URL, token, provider key or private file metadata. Each type has one registry publisher; a publisher may dispatch to multiple idempotent consumers rather than registering duplicate types.

| Type                        | Version/payload                                                                     | Owner/consumer                                                 |
| --------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `chat.message.publish`      | 1: messageId                                                                        | conversations → Mongo publication saga                         |
| `application.events.wakeup` | 1: userId                                                                           | application-events → Redis broadcast hint; durable PG catch-up |
| Future Path/Schedule events | eventId, objectType/id/version, conversationId, allowlisted actor/summary reference | owner committed outbox → conversations card adapter            |

Owner Path/Schedule event names/schema versions must be agreed when those owners implement them; don't claim hypothetical event IDs already registered. If replaying an older card event, store immutable event version, not update a newer current-state card. Current status/actions are hydrated from owner versioned reader; card is not an executable command.

PG-only notification work may use `OutboxConsumer.processOnce` receipt + notification transaction. Mongo work instead relies on unique messageId/eventId and Mongo transaction before acknowledgement. Never insert PG processed receipt first and then assume failed Mongo call will be retried.

Existing dispatcher bounded retries/backoff/failed retention/replay remain authoritative. Missing publisher is a failed retained event, not success. Reconciliation identifies stuck PREPARING/COMMITTED, Mongo PUBLISHED with PG not DELIVERED, failed registered event routes, cancelled orphan drafts and missing payload. Avoid scanning all content on each request.

## SSE owner integration

- Application-events exports `appendRecipientEvents(tx, references)` for PG owners and committed-outbox consumers, with stable per-recipient eventId, schema validation and counter locks last/sorted. It owns no domain tables and calls current owner read-access contracts before emit/replay.
- Proposal transition producers must include create/update/accept/reject/withdraw/expiry. Existing notification insertion and mark-read paths append feed events atomically or through persisted outbox; do not stream before the corresponding row/state commits. Duplicate/no-op notification read emits no new logical event.
- Chat publication acknowledgement exposes committed message/delivery references to both participants/sender respectively. Notification creation and chat-message event are distinct typed events, not duplicate chat messages. SSE replay must not re-create notification rows or increment unread counts.
- Read-watermark advancement persists MongoEventIntent alongside ReadState in a Mongo transaction; bridge PG recipient-feed append then Mongo ack. Persisted eventId protects crash after append/before ack. Storage scan/state transitions emit uploader-only CHAT file-status reference via committed PG source.
- Dedicated Redis subscriber broadcasts wakeups to all API instances with interested clients; persisted feed reader establishes ordering and durable recovery, including lost wakeups via server heartbeat catch-up. No primary client polling or competing-consumer routing for connected SSE clients.
- New permission `event:read:self` cannot bypass domain permission/membership. Validate live actor on connect/emission/heartbeat, close at token expiry/revoke, and keep no PG transaction open while writing frames. Slow-client buffer/connection lease cleanup requirements are in SSE contract.

## Storage/private-access contract

Storage binds once to `{type:"CHAT_MESSAGE",id:messageId}` under row locks and records attachedAt. Generation/size/MIME/checksum are server-verified; bound files cannot be stolen/rebound to another message. Chat storage methods enforce 15.000.000 cap without relaxing Evidence 10 MB or REPORT policy.

Download: live participant → published Message/attachment belongs to Conversation → current storage binding/generation/state READY/CLEAN → short-lived signature outside PG tx using existing storage policy. Unknown binding/wrong owner/resource →404. Revoked/unsafe current file never uses stale Mongo snapshot as authorization. Cleanup and binding share StoredFile locks. Existing stale-upload/quarantine cleanup remains active; the disabled purge concerns chat READY/draft/published retention, not all storage recovery.

## Integration boundaries left pending

LR's Path/Schedule `RequestLockReader` cannot be replaced by a constant false to make cancel pass. Implement a real owner contract when owner exists, or keep NEGOTIATING cancellation/future final-lock gated and report it. Catalog/tag/matching/public owner/eligibility readers can be wired now through implemented owners without implementing new search features.

Full case-scoped Staff/Admin chat evidence access, message reports, Path/Schedule producers, financial settlement and notification external channels are later owners/features. No blanket permission or arbitrary event payload serves as a shortcut.
