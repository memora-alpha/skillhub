# SSE Contract: Chat, Notification và Application Events

**Status**: SSE implementation added under the user decision “chat, noti và các event sử dụng sse thay vì socket”. Supersedes steady client polling as live-delivery transport. Focused handler checks pass; real proxy/multi-instance/replay-store verification remains pending in [validation](../validation.md).

## Endpoint and transport

`GET /api/v1/events`, authenticated user-wide multiplexed stream. Permission `event:read:self` plus each domain's current read/participant permission. No arbitrary userId/room subscription; events are assigned server-side to authorized recipients.

Successful response: `200`, `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-store, no-transform`; reverse proxy buffering/compression disabled for the route, flush frames promptly, keep-alive through proxy. Ordinary JSON envelope applies only to errors before stream headers; successful SSE uses frames, not `{success,data}` wrapping the entire response.

Client→server remains HTTP POST/PATCH for send, accept, read markers and other commands; SSE carries committed server→client updates. REST history/inbox/status endpoints support initial load, hydration and recovery; no periodic client polling as primary delivery. WebSocket/Socket.IO are outside the chosen transport.

Use a Nest HTTP streaming controller that completes authentication/cursor/capacity preflight before flushing headers and explicitly handles `write`/`drain`, bounded buffering and teardown. Existing Nest/Express/RxJS dependencies suffice; do not assume an unbounded Observable provides backpressure. Do not require a newer Nest SSE helper without checking installed exports.

## Authentication and lifecycle

- Connect using `Authorization: Bearer <accessToken>` and `Accept: text/event-stream`. Client uses a fetch-based SSE reader or equivalent library with custom headers; native browser EventSource's constructor does not provide arbitrary Authorization headers. No token/query-string or long-lived URL ticket. This is a client contract, not frontend implementation scope.
- Revalidate live session/account/security version/stream permission before connect and each emitted batch; recheck resource membership/domain permission before serializing that event. Heartbeat checks bound idle revocation detection. No PG transaction/row lock held for the lifetime of a stream.
- Access token expiry or session/grant/account revocation closes the connection. `stream.reauth-required` may precede expiry close, with no private data/id. Client refreshes via existing HTTP auth then reconnects with last processed cursor; SSE never extends token/session TTL.
- Initial 401/403/429/503 are ordinary HTTP errors. After headers, send only safe control frame if possible and close; don't attempt a second JSON response.
- Technical starting settings: heartbeat/auth idle check 15s; reconnect hint 3000ms with client bounded exponential backoff+jitter; maximum 100 buffered frames or 256 KiB per connection, whichever first. Configurable, documented operational defaults, not business retention/anti-spam policy. Per-user/session/IP/global connection caps must be validated deployment configuration and enforced across instances, using leased shared counters with expiry/release; no unlimited reconnect loop or permanent leaked slot.
- Disconnect/abort/setup failure/shutdown must cancel timers/DB catch-up tasks, release subscriber reference and leased connection slot. Readiness/shutdown drain behavior tested through the actual deployment proxy.

## Frame format and IDs

```text
id: <opaque-user-bound-cursor>
event: chat.message.created
data: {"eventId":"<uuid>","version":1,"occurredAt":"<UTC>","data":{"conversationId":"<uuid>","messageId":"<uuid>","messageSequence":"42"}}

```

The `id` is a signed, versioned, opaque resume cursor bound to this user/feed epoch and committed per-user event sequence. It is not the event UUID, per-Conversation messageSequence or a database outbox row ID. Sequence BIGINT serializes as string internally. No signing secret/token/resource text inside cursor or logs. `eventId` is stable logical recipient-event identity for dedupe; version identifies public schema.

Derive recipient event identity deterministically from `(sourceEventId, publicEventType, userId)` or persist an equivalent stable UUID mapping. One source event can yield both chat.message.created and chat.delivery.updated for the sender; those need distinct identities. Retrying the same projection retains its original identity.

Frame payloads are small reference projections, never raw private outbox payloads, message text, attachment bytes, storage keys, signed URLs, credentials or staff audit contents. Client hydrates through authorized REST APIs. SSE receipt is neither business Confirm nor chat read acknowledgement; explicit read/Confirm commands remain required.

### Initial load and reconnect

1. Fresh connection without cursor: server captures committed user-feed head, emits `stream.ready` with that anchor `id`, subscribes/catches up after anchor. Client buffers subsequent events while loading relevant REST snapshots/history/inbox, then applies buffered references idempotently. This connect-before-snapshot sequence avoids snapshot/live gaps across PG/Mongo.
2. Reconnect sends `Last-Event-ID` with last **processed** cursor. Fetch client explicitly persists/sets it after handling each frame. Server validates ownership/epoch/signature and replays all retained authorized events after that position in ascending sequence before live tail. No topics/filter query that changes cursor semantics.
3. Replay/live use the same persisted per-user sequence reader. Register wakeup subscription before capturing head, catch up against DB, and continue from last emitted sequence. Redis notifications merely wake this reader; they do not bypass ordering or become the source of payload.
4. Delivery is at-least-once: disconnect after write can cause replay; client dedupes by eventId and applies resource version/messageSequence monotonically. Server never claims exactly-once network delivery or advances a cursor for unsent frames.
5. Cursor malformed/wrong user/future epoch or sequence →400 before headers. Cursor outside retained range →409 `EVENT_CURSOR_EXPIRED` before headers; if discovered after connect, `stream.reset-required` without id followed by close. Client clears old cursor and repeats connect-before-snapshot. No silently skipping a retention gap.
6. Permission/resource loss: suppress private event and send `stream.checkpoint` with safe opaque cursor for traversed rows, no resource identifiers; it only advances resume progress. On regained access, fetch current state; suppressed history is not promised. Stream-level auth loss closes instead of checkpointing.

Heartbeats are SSE comments (`: heartbeat`) with no event ID and no unread/read effect. Controls other than ready/checkpoint carry no advancing ID. Slow consumers reaching buffer limit are closed, keeping last actually delivered cursor; reconnect/replay or explicit resync recovers. Never silently drop a business event and continue with a later cursor.

## Public event allowlist (schema v1)

| Event                                                                              | References / recipients                                                 | Durable source                                                        |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `proposal.created`, `proposal.updated`                                             | proposalId, proposalVersion; sender/recipient as authorized             | PG Proposal tx/outbox → recipient feed append                         |
| `proposal.accepted`, `proposal.rejected`, `proposal.withdrawn`, `proposal.expired` | proposalId, proposalVersion, conversationId if accepted; parties        | PG terminal transition/outbox → feed                                  |
| `chat.message.created`                                                             | conversationId, messageId, messageSequence; both participants           | Verified Mongo PUBLISHED + PG DELIVERED ack/outbox                    |
| `chat.delivery.updated`                                                            | conversationId, clientMessageId, messageId, deliveryStatus; sender only | PG publication receipt transition/outbox                              |
| `chat.read.updated`                                                                | conversationId, readerId, lastReadSequence, readAt; participants        | Mongo read-state transaction + durable Mongo event intent → PG feed   |
| `chat.attachment.updated`                                                          | fileId, state; uploader only before publication                         | Storage PG scan/status transition/outbox; CHAT/uploader authorization |
| `notification.created`, `notification.read`                                        | notificationId, version/readAt when applicable; owner only              | Inbox create/read transaction + feed/outbox                           |
| Future owner business events                                                       | objectType/id/version and authorized recipients                         | Committed owner outbox → allowlisted mapper                           |

Connection implementation wires the listed proposal/chat/notification producers, including existing in-app notification create/read paths. Path/Schedule/session/credit or other future owners adopt the same SSE channel when implemented; their runtime producers remain Pending. Never forward every internal event automatically. Read-state/file event durability is required, not a best-effort in-process emit.

## Durable feed and multiple instances

- Shared `application-events` module owns PG `UserEventStream` (userId, epoch, lastSequence, firstRetainedSequence) and `UserEventDelivery` (userId, sequence, eventId, public type/version, safe reference payload, occurredAt). Unique `(userId,sequence)` and `(userId,eventId)`.
- Allocate feed sequence under per-user counter lock **inside the append transaction** so commit order cannot skip an earlier uncommitted row. Use sorted user IDs for multi-recipient append and acquire these technical counter locks after existing business locks. Do not use a standalone global BIGSERIAL as commit-order cursor.
- PG owner changes can append via exported event-writer in the same tx. Outbox-fed owners append through an idempotent consumer transaction. Chat enters feed only after Mongo publication is verified; never announce a DRAFT as new message. Duplicate ack/consumer produces same recipient event identity.
- Mongo-owned read-state advancement writes a durable `MongoEventIntent` in the same local transaction; worker idempotently appends PG feed then acknowledges intent. Crash after PG commit/before Mongo ack replays same eventId. No Mongo call inside PG transaction and no PG-only receipt falsely proving Mongo atomicity.
- Feed append persists a reference-only wakeup outbox. Publisher broadcasts wakeup to Redis Pub/Sub after commit; each API process uses a **dedicated duplicated subscriber connection**, not the command RedisService connection. All instances with interested clients may wake; no competing-consumer group that delivers to only one server.
- Pub/Sub loss/outage is recovered by server-side DB catch-up on heartbeat and reconnect. API clients continue SSE; they do not switch primary delivery to polling. Persisted log/outbox remains authoritative, local memory holds only bounded sockets/subscriptions.
- Replay window/row caps are explicit operational deployment config; separate from chat/file retention. Trim only a contiguous sequence prefix under stream lock, atomically updating firstRetainedSequence. No pruning arbitrary interior rows or deleting chat because event replay expires. Stale cursors require explicit resync.
- Domain hydration uses existing owner contracts/live authorization. Check current resource access on replay, not only access at original event creation.

## Verification gates

Before calling SSE implemented: real HTTP stream framing/no-buffer proxy test; Authorization/expiry/refresh/revocation; initial snapshot/live race; Last-Event-ID replay/dedupe/out-of-order publication; forged/cross-user/expired cursor; two API instances and reconnect to another; Redis disconnect/missed wakeup/worker retry; PG/Mongo bridge crash; read/file/notification producer atomicity; slow consumer backpressure; shutdown/abort resource release; bounded replay/cap cleanup; no data leak in payload/logs.

## Primary references

- [WHATWG SSE standard](https://html.spec.whatwg.org/multipage/server-sent-events.html): HTTP event framing, Last-Event-ID/reconnect and EventSource interface.
- [NestJS SSE documentation](https://docs.nestjs.com/techniques/server-sent-events): framework stream integration/lifecycle; installed-version exports still need verification.
- [Redis Pub/Sub delivery semantics](https://redis.io/docs/latest/develop/pubsub/): at-most-once transport motivates durable log/catch-up design.
