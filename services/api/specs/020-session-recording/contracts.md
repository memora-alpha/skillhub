# Contract: Session Recording

All responses use the standard envelope (`success`, `statusCode`, `message`, `data` | `details`) and
send `Cache-Control: no-store`. Every route needs `session-recording:manage:participant` and Session
membership (teacher or learner), except the Staff review route, which follows spec D10.

Common errors: `403 SESSION_ACCESS_DENIED`, `404 SESSION_NOT_FOUND`, `404 RECORDING_NOT_FOUND`,
`503 RECORDING_DISABLED` (`recording.enabled` is off), `503 RECORDING_UNAVAILABLE` (LiveKit or the
recording bucket is not configured).

## Recording object

```json
{
  "id": "…",
  "sessionId": "…",
  "status": "READY",
  "kind": "ROOM_COMPOSITE_VIDEO",
  "requestedByUserId": "…",
  "acceptedByUserId": "…",
  "requestedAt": "2026-12-01T10:02:00.000Z",
  "startedAt": "2026-12-01T10:02:20.000Z",
  "endedAt": "2026-12-01T10:58:00.000Z",
  "durationMs": 3340000,
  "bytes": 512000000,
  "stopReason": "PARTICIPANT",
  "retentionDays": 90,
  "expiresAt": "2027-03-01T11:00:00.000Z",
  "heldByReport": false,
  "deletedAt": null
}
```

`status` ∈ `REQUESTED`, `DECLINED`, `REQUEST_EXPIRED`, `STARTING`, `RECORDING`, `STOPPING`, `READY`,
`FAILED`, `EXPIRED`, `DELETED`. `retentionDays` is the requester's plan snapshot taken when the
recording started (spec 021 D12); recordings made before plans have none, and the list shows
`recording.retentionDays` for them. `expiresAt` is `endAt + retentionDays`. No URL or object key is ever
part of this object.

## `POST /api/v1/sessions/:sessionId/recordings`

Asks the other participant to agree. Body: none. `201` → recording object with `REQUESTED`.

| Status | message                       | When                                                                  |
| ------ | ----------------------------- | --------------------------------------------------------------------- |
| 409    | `RECORDING_ALREADY_ACTIVE`    | Another request or recording is active for this Session.              |
| 409    | `RECORDING_WINDOW_NOT_OPEN`   | Outside the join window, or the Session is not `READY`/`ONGOING`.     |
| 409    | `RECORDING_ROOM_NOT_STARTED`  | No participant has joined yet, so there is no LiveKit room to record. |
| 403    | `RECORDING_PLAN_REQUIRED`     | The requester has no current plan that includes recording (spec 021). |
| 409    | `RECORDING_MINUTES_EXHAUSTED` | The requester has no period or add-on minute left (spec 021).         |

The other participant is notified (phase 3). An unanswered request becomes `REQUEST_EXPIRED` after 2
minutes; the list reports it as expired at once, and the next request or the worker stores it.

## `POST /api/v1/sessions/:sessionId/recordings/:recordingId/accept`

Only the participant who did not request, while the request window of `POST …/recordings` still holds
(the same `409` and `503` codes apply). The requester's plan and minutes are checked again, so
`403 RECORDING_PLAN_REQUIRED` and `409 RECORDING_MINUTES_EXHAUSTED` also apply; accepting pins the
requester's subscription and retention on the recording. `200` → recording object with `STARTING`. The API then starts
Egress; `egress_started` moves it to `RECORDING` and sets the room metadata indicator. If Egress cannot
start, the response is the recording with `FAILED`, and a new request may follow.

## `POST /api/v1/sessions/:sessionId/recordings/:recordingId/decline`

Only the participant who did not request. `200` → recording object with `DECLINED`.

## `POST /api/v1/sessions/:sessionId/recordings/:recordingId/stop`

Either participant, once accepted (`STARTING` or `RECORDING`). `200` → recording object with
`STOPPING`, or the current object when it is already stopping or terminal (idempotent). A `REQUESTED`
row returns `409 RECORDING_STATE_CONFLICT`: answer it with `decline` instead. `egress_ended` moves it to
`READY` or `FAILED`.

Accept, decline and stop on the wrong status return `409 RECORDING_STATE_CONFLICT` with
`details.status` set to the current status. Accept or decline by the requester returns
`403 RECORDING_ACTION_NOT_ALLOWED`.

## `GET /api/v1/sessions/:sessionId/recordings`

`200` → `{ "items": [recording, …] }`, newest first. `DELETED` and `EXPIRED` rows stay listed without
a file, so both participants can see what happened.

## `GET /api/v1/sessions/:sessionId/recordings/:recordingId/playback`

`READY` only, until `expiresAt`. `200` →

```json
{
  "url": "https://…",
  "expiresAt": "2026-12-01T12:05:00.000Z",
  "mime": "video/mp4"
}
```

The URL is a presigned GET valid for 5 minutes with `Content-Disposition: inline`. S3 serves range
requests, so players can seek. Request a new URL when it expires. `mime` is `video/mp4`, or
`audio/mp4` for `AUDIO_ONLY`. Other statuses, and a recording past `expiresAt` that no open report
holds, return `409 RECORDING_NOT_READY`. A signing failure returns `503 RECORDING_UNAVAILABLE`.

## `DELETE /api/v1/sessions/:sessionId/recordings/:recordingId`

Either participant, `READY` only. Removes the file for both and cannot be undone. `200` → recording
object with `DELETED`. The other participant is notified. Deleting an already deleted recording returns
the same object (idempotent).

While a report in `OPEN`, `UNDER_REVIEW` or `NEED_MORE_INFO` targets the Session or has it as
`relatedSessionId`, the delete returns `409 RECORDING_HELD_BY_REPORT`. It succeeds once the report
closes. The same hold keeps the recording past `expiresAt`; the list then shows `"heldByReport": true`.

## `GET /api/v1/sessions/:sessionId/recordings/:recordingId/staff-review?caseId=<uuid>`

For the Staff member handling a report on this Session (spec D10). The caller needs `report:moderate`,
the STAFF or ADMIN role, and must be the case handler. The case must be `OPEN`, `UNDER_REVIEW` or
`NEED_MORE_INFO` and target the Session or have it as `relatedSessionId`. The recording must be
`READY`. `200` → the same body as `playback`, plus `caseId`.

Each URL issued writes the audit entry `REPORT_EVIDENCE_READ` (target `SESSION_RECORDING`, the
recording id, `after: { caseId, access: "READ" }`) in the same transaction. A refused request writes no
audit entry.

Errors, checked in this order:

- `403 STAFF_ACCESS_REQUIRED`
- `404 REPORT_CASE_NOT_FOUND`
- `403 REPORT_CASE_NOT_ASSIGNED_TO_CALLER`
- `409 REPORT_CASE_NOT_OPEN`
- `404 SESSION_NOT_IN_REPORT_CASE`
- `404 RECORDING_NOT_FOUND`
- `409 RECORDING_NOT_READY`

## Room metadata

While a recording is `RECORDING`, the room metadata holds:

```json
{ "recording": { "id": "…", "kind": "ROOM_COMPOSITE_VIDEO" } }
```

It is cleared on any terminal status. Clients must show the recording indicator from this metadata.

## Notifications

| Event                         | To                                  |
| ----------------------------- | ----------------------------------- |
| `session.recording.requested` | The other participant (in-app).     |
| `session.recording.failed`    | Both participants.                  |
| `session.recording.deleted`   | The participant who did not delete. |

## Client flow

1. In the room, either participant calls `POST …/recordings`. The other sees a consent dialog that
   states both purposes (learning review first, evidence if a report is opened) and calls `accept` or
   `decline`.
2. Both clients show the indicator from room metadata. Either may call `stop`.
3. After the Session, list the recordings and call `playback` to stream a `READY` one. Offer no
   download button. Offer `DELETE` with a confirmation that it removes the file for both.
