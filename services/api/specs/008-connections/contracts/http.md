# HTTP Contracts: Kết nối

**Status**: API controllers/DTOs/Swagger added; prefix `/api/v1`. Module/route metadata and focused boundaries are tested; real provider journeys remain pending in [validation](../validation.md).

Live updates for chat, notification and application events use `GET /api/v1/events` under [SSE contract](sse.md), including Bearer auth, framing, Last-Event-ID replay and expiry/resync. HTTP commands/history remain; successful SSE is a text/event-stream exception to ordinary JSON success envelopes.

## Shared rules

- Bearer access token → current session/account/security version/grants; explicit role/permission plus ownership/membership. USER actions do not automatically grant STAFF/ADMIN equivalent access. No blanket staff chat route.
- Success `{success:true,message,data,meta?}`; error current `{success:false,message,statusCode}`. Domain code occupies `message` under existing envelope; do not invent a breaking error shape. 204 has no body. Correlation ID follows existing HTTP conventions.
- UUID IDs, ISO-8601 UTC timestamps; version positive safe integer. Decimal Credit and BSON Long sequence are JSON strings. Reject unknown fields, invalid enums/ranges, client-assigned actor/time/metadata/card fields.
- Mutating Proposal commands require `Idempotency-Key` using foundation validated length/format; command fingerprint includes resource/expectedVersion/body. Same identity/body replays after live auth/membership; different body 409. Reply resource is hydrated from stable reference; return current resource state, not a fabricated historical snapshot.
- Message send uses clientMessageId UUID as durable idempotency identity for sender+Conversation. No unrelated second key is needed. Same identity/body replays; conflicting body 409; identity remains protected after publication.
- List `limit` default 20, max 100 (technical pagination choice). Opaque cursor must be valid for viewer/filter/order/resource; do not include private text. Paginated response puts `{limit,nextCursor,hasMore}` in `meta.pagination`, aligned with existing API helpers; no total unless actually measured.
- Nonowner/nonparticipant resource → 404; invalid/expired session → 401; authenticated actor missing action permission/restricted → 403; state/version/source conflicts →409; missing dependent policy/provider →503; shared rate limit →429 with retry hint.

## Proposal routes

| Method/path                                          | Action                      | Result                              |
| ---------------------------------------------------- | --------------------------- | ----------------------------------- |
| POST `/proposals`                                    | `proposal:create`           | 201 Proposal, idempotent replay 200 |
| GET `/proposals?direction=received\|sent&status=...` | `proposal:read:party`       | 200 cursor page, actor-scoped       |
| GET `/proposals/{id}`                                | `proposal:read:party`       | 200 party-only detail               |
| PATCH `/proposals/{id}`                              | `proposal:update:self`      | 200, proposer/PENDING/CAS           |
| POST `/proposals/{id}/accept`                        | `proposal:accept:recipient` | 200 `{proposal,conversation}`       |
| POST `/proposals/{id}/reject`                        | `proposal:reject:recipient` | 200 terminal Proposal               |
| POST `/proposals/{id}/withdraw`                      | `proposal:withdraw:self`    | 200 terminal Proposal               |

Request owner lists received proposals via GET `/proposals?direction=received&learningRequestId=...`; server verifies ownership of the filter and does not expose competitors' proposal details to another proposer. Status filter is allowlisted. No arbitrary `userId` scope query.

### Create body (discriminated by sourceType)

```json
{
  "sourceType": "LEARNING_REQUEST",
  "learningRequestId": "<uuid>",
  "message": "Tôi có thể hướng dẫn bạn theo mục tiêu này.",
  "exchangeTypeHint": "ONE_WAY",
  "proposedCredit": "100.00",
  "proposedDurationMinutes": 60,
  "initialSessionCount": 2,
  "candidateSlots": "Tối Thứ 5 và Thứ 7"
}
```

Message 10–1000; duration/credit/count/candidateSlots optional. `candidateSlots` is now free-text schedule guidance (`string | null`), sanitized as plain text, NFC-normalized and trimmed; null or blank clears it. It does not confirm a schedule and has no timestamp/range interpretation. Old array/object payloads are rejected with 400. Source Request forbids recipientId/skillId/sharingSkillId and derives those from locked Request; supplied extra fields 400.

Direct variant requires `sourceType:DIRECT_SEARCH`, `recipientSharingSkillId:<uuid>` and message/suggestions; forbids learningRequestId/recipientId/skillId. Resolve recipient+skill via public owner contract, not arbitrary IDs. Direct initiator may be learner; no fixed teacher/exchangeType commitment.

proposedCredit requires exchangeTypeHint; canonical positive decimal string ≤`9999999999.99`, at most 2 fractional digits, no exponent/sign/whitespace. TWO_WAY ≥`20.00`; ONE_WAY >0 plus configured min/max. Convert exactly to BIGINT hundredths. Optional hint is never negotiation confirmation.

PATCH `{expectedVersion,...mutableFields}` permits message/candidateSlots/duration/credit/typeHint/count only. Explicit null clears optional hints; missing means unchanged; resulting full object must be valid. Source/parties/skill/expiresAt immutable. Expiry updates default proposal: keep original expiry, gated on G-01 decision. All terminal commands `{expectedVersion}`. accept may also include `expectedRequestVersion` when a Request snapshot was displayed; always recheck current source even when omitted.

2026-10-19 breaking contract amendment: request and response `candidateSlots` changed from a timestamp array to nullable text to match the current mobile schedule input. Mobile integration maps `schedule` to `candidateSlots`. Migration `20261019000000_proposal_schedule_text` must precede this API version; coordinate client rollout and API restart in the same release window. Empty legacy arrays become null; populated arrays remain serialized JSON text, preserving every original timestamp. No proposal status, version, expiry or lifecycle event is changed. Older clients expecting arrays require an update.

Proposal response: `id,sourceType,learningRequestId,proposerId,recipientId,skillId,message,exchangeTypeHint,proposedCredit,proposedDurationMinutes,initialSessionCount,candidateSlots,status,version,expiresAt,createdAt,updatedAt,conversationId?`. No email/auth/grants/private evidence/storage keys. ExpiresAt is server-owned.

Accept response contains same stable Conversation on replay; no wallet/session/path fields or creation side effects. Sibling Proposal state remains PENDING but `canAccept=false` can be derived from source availability; no silent auto-rejection.

## Conversation and Message routes

| Method/path                                                    | Permission                            | Result                                       |
| -------------------------------------------------------------- | ------------------------------------- | -------------------------------------------- |
| GET `/conversations`                                           | `conversation:read:participant`       | 200 PG metadata cursor page                  |
| GET `/conversations/{id}`                                      | `conversation:read:participant`       | 200 metadata; only participants              |
| GET `/conversations/{id}/messages`                             | `conversation:read:participant`       | 200 published Message page                   |
| POST `/conversations/{id}/messages`                            | `message:create:participant`          | 201 if verified PUBLISHED; 202 if processing |
| GET `/conversations/{id}/message-deliveries/{clientMessageId}` | `message:delivery:read:self`          | 200 sender-only status/reference             |
| POST `/conversations/{id}/read`                                | `conversation:read-state:update:self` | 200 own watermark                            |

Conversation metadata `{id,proposalId,learningRequestId,participantAId,participantBId,createdAt}` with public participant projection if needed via users owner reader. No arbitrary membership management. Mongo-derived summary/unread may be nullable during outage; never hide successful PG accept because a preview is unavailable.

Send body:

```json
{
  "clientMessageId": "<uuid>",
  "messageText": "Mình muốn trao đổi thêm về lịch học.",
  "attachmentFileIds": []
}
```

Text sanitized plain text 1–2000 if present; empty/whitespace after sanitization does not count. At least text or one file. attachmentFileIds unique UUIDs, max count/aggregate bytes from policy; no metadata/card/eventId/sentAt/sequence accepted. Revalidate digest and immutable draft on retry; current restrictions/permission still apply to client calls. Persisted authorized COMMITTED sends may finish after account revocation; this does not authorize later reads/replays.

201 data `{deliveryStatus:"DELIVERED",message:<public Message>}`; 202 data `{deliveryStatus:"PREPARING"|"PENDING",messageId,clientMessageId,statusUrl}`. `PREPARING` means receipt exists but payload/intent not fully committed; client can retry same body. `PENDING` means durable content and publication intent committed. Retryable infrastructure errors use 503 and stable identity can be retried. Status route is sender-only, rechecks current access; returns state, sanitized failure code, and published messageId/sequence if delivered. Never returns another sender's draft.

Public Message: `id,conversationId,senderId,messageText,messageType,attachments,objectType?,objectId?,objectVersion?,sequence,sentAt,readAt`. Each attachment exposes `attachmentId,fileId,filename,mimeType,fileSizeBytes,downloadUrlEndpoint`; no object key/scanner internals/checksum. Snapshot filename server-sanitized, not storage path. readAt is opposite participant projection for user messages; no claim of delivery just from read-side cache.

### History, reconnect and read

- First page: latest published `limit` messages, returned ascending sequence; nextCursor fetches older history with `beforeSequence`. No DRAFT results.
- Forward recovery/history sync: `afterSequence=<decimal-string>` plus limit; return ascending published messages, `hasMore` for backlog. before cursor and afterSequence are mutually exclusive. Client advances only to last returned sequence and drains backlog during initial load/resync; ongoing live updates arrive via SSE, without recurring list polling.
- Recovered drafts receive sequence at publication so late recovery remains visible after previous cursor. Duplicate event/send never gets a fresh sequence. Two transactions must not publish same sequence.
- Read command `{messageId}`. Server resolves a PUBLISHED message in that Conversation then advances user's own watermark only. Unknown/other Conversation/DRAFT target 404. Response `{lastReadSequence,lastReadAt}`. No arbitrary reader ID and no raw future sequence allowed.
- SSE chat events contain message references/sequence and are emitted only for published state. Hydrate with these existing authorized HTTP endpoints. SSE event receipt does not mark a message read; SSE cursor and Conversation messageSequence are different namespaces.

## Chat file routes

| Method/path                                                                        | Permission                              | Result                                 |
| ---------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| POST `/conversations/{id}/attachments`                                             | `message:attachment:create:participant` | 202 `{fileId,state:"QUARANTINED"}`     |
| GET `/conversations/{id}/attachments/{fileId}/status`                              | `message:attachment:create:participant` | 200 uploader-only pending/ready status |
| GET `/conversations/{id}/messages/{messageId}/attachments/{attachmentId}/download` | `message:attachment:read:participant`   | 200 short-lived signed download data   |

Upload multipart one file per request with stream cap 15.000.000 bytes; unbound CHAT upload's uploader is recorded by storage. Before send, only uploader sees pending status; download requires published owning Message, live participant and current StoredFile READY/CLEAN/same generation+binding. Download follows existing storage TTL/config, response URL private/no-store, never logged or cached in Message. Known fileId or URL issuance alone is not reusable application authorization; signed URL remains valid only for its configured short TTL.

413 too large; 415 unsupported/mismatched type; 409 file not ready/already bound; 404 wrong uploader/purpose/resource; 503 scanner/storage/policy unavailable. No client supplied storageKey, scan verdict, checksum or size authority.

## Representative domain errors

`REQUEST_NOT_AVAILABLE`, `REQUEST_VERSION_CONFLICT`, `PROPOSAL_VERSION_CONFLICT`, `PROPOSAL_EXPIRED`, `PROPOSAL_ALREADY_PENDING`, `TEACHER_SKILL_NOT_ELIGIBLE`, `DIRECT_TARGET_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`, `MESSAGE_NOT_READY`, `FILE_NOT_READY`, `FILE_ALREADY_BOUND`, `FILE_TOO_LARGE`, `CONNECTION_POLICY_UNAVAILABLE`. Map to envelope/status above; reuse existing code where semantics match. No reason leakage to unauthorized callers.

## Excluded routes

No generic create-conversation, staff chat browser, user-injected system message, message edit/delete, end/reopen negotiation, Confirm Path/Schedule, Credit, Session or realtime socket route. Future card actions call owner APIs with object/version and their own authorization.
