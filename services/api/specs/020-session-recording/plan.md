# Implementation Plan: Session Recording

**Spec**: [spec.md](spec.md) (D1–D10, approved 2026-11-26). **Contract**: [contracts.md](contracts.md).
**Tasks**: [tasks.md](tasks.md).

Scope: backend only, in `services/api`. Clients get their own specs. The feature ships dark behind
`recording.enabled = false`.

## Architecture

```text
Client (room) ──request / accept / stop──▶ API ──EgressClient──▶ LiveKit Egress
                                            ▲                       │ writes MP4
                                            │ egress_* webhooks     ▼
                                            └───────────────── S3 bucket, prefix recordings/
Learner / teacher / case handler ──GET playback──▶ API ──signGet (5 min, inline)──▶ S3
```

- Only the API talks to Egress. Clients never see Egress or storage credentials.
- Egress uploads with its own credentials, passed in each start request. Use a dedicated key that may
  only `PutObject` under `recordings/`. The API reads and deletes with its existing storage key.
- Object key: `recordings/<sessionId>/<recordingId>.mp4`.
- Recordings live in `learning-sessions`. Staff reach them only through the report-case check that
  spec 019 P2 uses (D10). The reports module itself does not change.

## Data model

New support schema `prisma/session-recording-support.prisma`, back-relation on `Session` through
`scripts/generate-runtime-schema.mjs`, migration `20261126000000_session_recording`.

`session_recordings`:

| Column                                        | Notes                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `id` UUID PK                                  |                                                                               |
| `session_id` FK → sessions                    | Many per Session; stop and restart makes a new row.                           |
| `requested_by_user_id`, `accepted_by_user_id` | `accepted_by` is null until accepted; CHECK `accepted_by <> requested_by`.    |
| `status`                                      | Enum, see the status machine.                                                 |
| `kind`                                        | `ROOM_COMPOSITE_VIDEO` or `AUDIO_ONLY`, fixed when the request is created.    |
| `egress_id` unique nullable                   | Matches webhooks and `listEgress`.                                            |
| `object_key`, `bytes`, `duration_ms`          | Set when a complete file is reported.                                         |
| `requested_at`, `started_at`, `ended_at`      |                                                                               |
| `stopped_by_user_id` nullable, `stop_reason`  | `PARTICIPANT`, `WINDOW_CLOSED`, `ROOM_FINISHED`, `MAX_DURATION`, `DISABLED`.  |
| `failure_code` nullable                       | Short code only. Provider messages may hold credentials and are never stored. |
| `deleted_at`, `deleted_by_user_id` nullable   | Retention sets only `deleted_at`; a participant sets both.                    |

A partial unique index allows one active row (`REQUESTED`, `STARTING`, `RECORDING`, `STOPPING`) per
Session.

### Status machine

```text
REQUESTED ──accept──▶ STARTING ──egress_started──▶ RECORDING ──stop / window / cap──▶ STOPPING
  │   └──decline──▶ DECLINED          └──start error──▶ FAILED                           │
  └──2 min unanswered──▶ REQUEST_EXPIRED                          egress_ended ──▶ READY | FAILED
READY ──participant DELETE──▶ DELETED                READY ──retention──▶ EXPIRED
```

Every transition runs in a Serializable transaction with a conditional `updateMany` on the expected
status, as the whiteboard save does. Egress calls happen after the commit that moves a row to
`STARTING` or `STOPPING`. The reconcile worker repairs rows whose call failed or whose webhook was lost.

## Configuration keys (`CONFIGURATION_DEFINITIONS`, mutable)

| Key                             | Schema                                | Default | Meaning                                                   |
| ------------------------------- | ------------------------------------- | ------- | --------------------------------------------------------- |
| `recording.enabled`             | boolean                               | `false` | Kill switch. Off also stops active recordings.            |
| `recording.kind`                | `ROOM_COMPOSITE_VIDEO` / `AUDIO_ONLY` | video   | Kind of new recordings.                                   |
| `recording.retentionDays`       | int 1–3650                            | 90      | Days after `endAt` before expiry.                         |
| `recording.overrunMinutes`      | int 0–60                              | 10      | Cap = Session length + this. The join window also bounds. |
| `recording.monthlyAlertMinutes` | int ≥ 0                               | 0       | Monthly total that raises an ops alert; 0 turns it off.   |

Environment (`.env.example`): `RECORDING_STORAGE_ACCESS_KEY_ID` and
`RECORDING_STORAGE_SECRET_ACCESS_KEY`, set as a pair. Egress uploads into the existing bucket
(`S3_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_REGION`), so `STORAGE_ENABLED=true` is required and the
API signs playback with its existing `ObjectStorage`. `recordingStorageConfiguration` validates this
at startup and never echoes values. When the pair or LiveKit is missing, requests return
`503 RECORDING_UNAVAILABLE`.

Permission `session-recording:manage:participant`, granted to USER. A release seed request with
`["identity", "configuration"]` ships with the migration.

## Code layout (under `src/modules/learning-sessions` unless noted)

| File                                                                                        | Role                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `domain/recording.policy.ts`                                                                | Status machine, when a request is allowed (D3), cap and expiry. Pure.                                |
| `application/services/session-recording.service.ts`                                         | request, accept, decline, stop, list, playback, delete.                                              |
| `application/services/session-recording-events.service.ts`                                  | Applies egress webhooks and reconcile results.                                                       |
| `infrastructure/livekit/livekit-egress.service.ts`                                          | Wraps `EgressClient` and room metadata; maps provider errors to codes.                               |
| `infrastructure/jobs/session-recording-reconcile.worker.ts`                                 | Every minute: stuck rows, window close, cap, unanswered requests.                                    |
| `infrastructure/jobs/session-recording-retention.worker.ts`                                 | Hourly: expiry after `retentionDays`, skipping Sessions an open report holds; monthly minutes alert. |
| `presentation/http/session-recording.controller.ts`, `session-recording.dto.ts`             | Routes in [contracts.md](contracts.md).                                                              |
| `presentation/http/livekit-webhook.controller.ts`                                           | Adds a second `processOnce` consumer `livekit.session-recording`.                                    |
| `src/modules/notifications/infrastructure/events/session-recording-notification.handler.ts` | Request, failure and deletion notices from outbox events.                                            |
| `domain/report-hold.policy.ts`                                                              | Shared open-report check for the whiteboard and recordings (moved from `whiteboard.policy.ts`).      |
| `src/shared/http/http-exception.filter.ts`                                                  | Allowlist `details.status` for `RECORDING_STATE_CONFLICT`.                                           |

## Report hold and Staff review

- A shared helper, extracted from the whiteboard service, answers "does an open report hold this
  Session?" with `WHITEBOARD_HOLD_REPORT_STATUSES` and `reportedSessionIds`. The whiteboard freeze,
  the whiteboard retention and the recording rules all use it, so they cannot drift apart.
- Participant `DELETE` checks the hold inside its Serializable transaction. A report filed at the same
  moment either blocks the delete or makes it retry. The object is removed only after that commit.
- The retention worker pages by id like spec 019 P3 and skips held Sessions without stalling.
- `staff-review` reuses the spec 019 P2 order of checks: permission and role, case exists, caller is
  the handler, case is open, case links the Session, recording is `READY`. It then writes
  `REPORT_EVIDENCE_READ` and signs the URL in the same transaction.

## Room indicator

When a row enters `RECORDING`, the API sets room metadata `{ "recording": { "id", "kind" } }`. It
clears the metadata on any terminal status. Clients show the indicator from room metadata, never from
their own state, so both sides always agree.

## Phases

1. **Foundation**: schema, migration, config keys, permission, seed request, env, policy unit tests.
2. **Consent flow**: request, accept, decline, stop, unanswered-request expiry, the Egress wrapper
   with a fake client in tests.
3. **Provider events**: webhook consumer, reconcile worker, room metadata, failure notices.
4. **Viewing and lifecycle**: list, playback URL, participant delete with notice and report hold,
   retention worker with report hold, monthly minutes alert.
5. **Staff review (D10)**: extract the spec 019 P2 case check into a shared helper, add the
   staff-review route and its audit.
6. **Verification and docs**: PostgreSQL integration tests, a manual run against LiveKit Cloud and a
   test bucket, `livekit-sessions.vi.md`, the Egress setup guide.

Each phase ends green on lint, types, build and its tests, and can be its own commit.

## Risks

- **Credentials at the provider.** Egress needs upload credentials per request. The dedicated
  put-only key limits the damage if they leak.
- **Lost webhooks.** The reconcile worker compares active rows with `listEgress` every minute.
- **Egress keeps running.** The worker stops Egress at window close and at the cap, even without
  webhooks.
- **Cost.** Kill switch, per-recording cap and monthly alert. A 90-day retention needs a storage
  budget; measure real file sizes in phase 5 before turning it on.
- **Not DRM.** Presigned URLs can be saved. D5 accepts this.
