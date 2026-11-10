# Schedule confirmation and finalization communications

Date: 2026-11-10. Branch: `fix/schedule-system-messages`, based on current `dev`
including PR #96. Backend only; no OAuth, frontend or mobile changes.

## Behavior and contracts

- `POST /api/v1/schedule-proposals/:scheduleId/confirm`: the first successful
  confirmation by each participant/version records one system chat message and
  one `learning-path.schedule.confirmed` notification for the other participant.
  Chat copy includes the actor and teacher/learner display names. Both-confirmed
  copy refers only to this schedule, not all schedules/the finalized agreement.
- Pending reschedule copy says the effective schedule remains unchanged; applied
  reschedule copy is recorded only after both confirmations and successful apply.
- `POST /api/v1/learning-paths/:pathId/finalize`: successful lock records one
  system message with the number of created sessions. Keep the existing
  `learning-path.locked` notification to both participants; do not duplicate it.
- Repeating a confirmation, stale/forbidden calls, locked replays and idempotent
  finalize replays produce no additional communication intents. Transaction
  failures roll back the state change and new intents together.

HTTP request/success shapes are unchanged. Chat history uses existing
`messageType: SYSTEM`, plain `messageText` and `objectType/objectId/objectVersion`:
`SCHEDULE_PROPOSAL` for confirmations, `LEARNING_PATH` for finalization. The sender
is the acting participant; this does not mean the user authored the system copy.
Clients must render message text as text, and can use object references to refresh
the agreement. Public message creation still accepts only text/files.

## Ownership and reliable delivery

Scheduling owns the version/actor confirmation event; LearningPaths owns lock and
sessions. User display names come from a users-owned read contract. Conversations
exposes `enqueueSystemMessage(tx, input)` to stage an immutable content snapshot,
digest, COMMITTED ChatPublication and `chat.system.publish` outbox row in the
caller's PostgreSQL transaction. No MongoDB call occurs in that transaction.

After commit, the registered system publisher validates the snapshot against its
receipt, creates/reuses the Mongo draft, and uses the existing idempotent chat
publication workflow. Message IDs/digests survive a crash after either Mongo
commit or PostgreSQL acknowledgment. Missing drafts are recoverable from the
outbox snapshot. The existing worker bounds retries and retains failed events;
operators may replay failed events after restoring Mongo/index prerequisites.

Published system messages update Inbox activity/unread and emit the existing
`chat.message.created` SSE for both participants. They do not emit a user-send
delivery acknowledgment or generic `chat.message.delivered` notification:
domain notifications already cover these actions. Each notification channel uses
the existing receipt dedupe and learning notification preference; channels follow
`NOTIFICATION_CHANNELS` (IN_APP by default, EMAIL/PUSH only when enabled).
Notification and chat use separate outbox events, so either can recover without
resending the other. Delayed events retain their original names/version/status
snapshot; clients obtain current state from the owner API, not old message copy.

No migration/configuration/seed is required. Existing rows are not backfilled.
Restart API/worker on release to register the new event types. Plain message copy
is also retained in PostgreSQL outbox payloads for recovery under its existing
retention controls; Mongo remains the published-history authority.

## Constitution Check

| Principles                  | Status / evidence                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 7: scope and ownership   | Pass for design: Conversations owns all receipt/Mongo writes, Users owns display-name reads; source owners stage events via the conversation contract.         |
| 2, 3: state and atomicity   | Pass for design: source state and intents commit in PG; published chat remains Mongo authority; no external I/O under PG locks.                                |
| 4: access and privacy       | Pass for design: existing participant/version checks precede event creation; trusted snapshots contain participant-facing text and IDs only.                   |
| 5: public API               | Pass for design: no new public route/input, existing SYSTEM history and SSE shape; new notification type and object references documented.                     |
| 6: verification             | Pass locally: API lint/types/build and 132 regression cases, including HTTP/bootstrap; 9 storage integration cases skipped. See validation below.              |
| 8: asynchronous reliability | Pass for design: durable immutable snapshot, IDs/digests, existing outbox leases/retry/manual replay and receipt/channel dedupe. Runtime verification pending. |

No exceptions. Do not claim live push/email, production Mongo or deployment
verification from local fixtures.

## Validation

Completed on 2026-11-10:

- `pnpm --filter api lint`: passed.
- `pnpm --filter api check-types`: passed, including Prisma generation.
- `pnpm --filter api build`: passed.
- From `services/api`, outside the sandbox for HTTP localhost access:

  ```text
  node --test --test-reporter=spec test/connections/*.test.mjs test/learning-platform-audit.test.mjs test/learning-platform/phase*.test.mjs test/learning-platform/error-http.test.mjs test/learning-platform/schedule-validation.test.mjs test/learning-platform/schedule-communication.test.mjs test/learning-platform/finalize.integration.test.mjs
  ```

  141 cases: 132 passed, 0 failed, 9 skipped. Covers confirmations and revisions,
  both actors/versions and locked replays, one lock message on finalize replay,
  no new intents on rejected finalize, reschedule pending/apply/cutoff,
  notification recipients/preferences/channels and failed-channel retry,
  immutable chat intents, Mongo outage/post-publish crash recovery, concurrent
  replay dedupe, Inbox activity and SSE without generic duplicate notifications.
  Nest module bootstrap registers both new handlers; existing HTTP input tests
  still reject user-injected SYSTEM/object metadata.

- Updated real PostgreSQL suite checks concurrent duplicate confirmations and
  rollback after chat/notification outbox failure, including failure after
  Hold/lock/session writes. Updated real Mongo suite checks concurrent SYSTEM
  publication and history. These were skipped because `TEST_DATABASE_URL` and
  `TEST_MONGODB_URI` were unset; Docker's local daemon was not running. Real
  storage concurrency/rollback remains a release verification gate.
- Formatting and `git diff --check`: passed.

The first test runs found two outdated test doubles: the chat draft mock overwrote
published messages instead of matching Mongo's immutable `$setOnInsert`, and the
audit-only reschedule fixture lacked the new communication ports. Both were
corrected; the full final run above passed.

No live email/push delivery, production storage, migration or deployment was
performed during local validation.
