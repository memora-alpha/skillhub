# Contract: Session Whiteboard

All responses use the standard envelope (`success`, `statusCode`, `message`, `data` | `details`).
Both endpoints send `Cache-Control: no-store`.

## `GET /api/v1/sessions/:sessionId/whiteboard`

Permission `session:read:participant` + Session membership.

```json
{
  "revision": 0,
  "sceneData": null,
  "updatedAt": null,
  "updatedByUserId": null,
  "retentionDays": null,
  "readOnly": false,
  "readOnlyReason": null,
  "editableFrom": "2026-11-02T09:50:00.000Z",
  "editableUntil": "2026-11-03T11:00:00.000Z"
}
```

`readOnlyReason` ∈ `SESSION_NOT_EDITABLE`, `SESSION_UNDER_REPORT`, `WHITEBOARD_POLICY_NOT_READY`,
`EDIT_WINDOW_NOT_OPEN`, `EDIT_WINDOW_CLOSED`, or `null`. The edit window is computed for the
caller (`whiteboard.editWindow`, see spec P1):

- `editableFrom`: the join window opening. It is `null` for the teacher when `teacherPrepare` is on,
  because the teacher may edit as soon as the Session is confirmed.
- `editableUntil`: `max(join window close, endAt + afterEndMinutes)`. After it the board is frozen.
- Both are `null` when the Session status freezes the board (`CANCELLED`, `DISPUTED`, `NO_SHOW`,
  `MAKEUP_REQUIRED`), when an `OPEN`, `UNDER_REVIEW` or `NEED_MORE_INFO` report targets or relates to
  the Session (`SESSION_UNDER_REPORT`), or when the configuration is not ready.

A read-only board still returns its last scene, so it can be reviewed after the Session.

Errors: `403 SESSION_ACCESS_DENIED`, `404 SESSION_NOT_FOUND`.

## `PUT /api/v1/sessions/:sessionId/whiteboard`

Permission `session-whiteboard:update:participant` + Session membership.
Body limit: 2 MiB + 4 KiB for this route only.

```json
{
  "expectedRevision": 3,
  "sceneData": { "elements": [], "appState": {}, "files": {} }
}
```

`200` → `{ "revision": 4, "updatedAt": "2026-11-02T10:05:00.000Z" }`

| Status | message                                                              | details                                                                                                     |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 400    | validation message / `INVALID_WHITEBOARD_SCENE`                      | —                                                                                                           |
| 403    | `SESSION_ACCESS_DENIED`                                              | —                                                                                                           |
| 404    | `SESSION_NOT_FOUND`                                                  | —                                                                                                           |
| 409    | `WHITEBOARD_REVISION_CONFLICT`                                       | `{ currentRevision }`                                                                                       |
| 409    | `WHITEBOARD_READ_ONLY`                                               | `{ reason }` (`SESSION_NOT_EDITABLE`, `SESSION_UNDER_REPORT`, `EDIT_WINDOW_NOT_OPEN`, `EDIT_WINDOW_CLOSED`) |
| 413    | `WHITEBOARD_SCENE_TOO_LARGE` (scene) or a body-parser 413 (raw body) | —                                                                                                           |
| 503    | `WHITEBOARD_POLICY_NOT_READY`                                        | —                                                                                                           |

## `GET /api/v1/sessions/:sessionId/whiteboard/staff-review?caseId=<uuid>`

The caller needs `report:moderate`, the STAFF or ADMIN role, and must be the case handler. The case must be
`OPEN`, `UNDER_REVIEW` or `NEED_MORE_INFO`. It must target this Session or have it as `relatedSessionId`.
The endpoint is read-only. Each successful read writes the audit entry `REPORT_EVIDENCE_READ`, with target
`SESSION_WHITEBOARD` and the Session id.

```json
{
  "caseId": "…",
  "revision": 4,
  "sceneData": { "elements": [] },
  "updatedAt": "…",
  "updatedByUserId": "…"
}
```

Errors:

- `403 STAFF_ACCESS_REQUIRED`
- `403 REPORT_CASE_NOT_ASSIGNED_TO_CALLER`
- `404 REPORT_CASE_NOT_FOUND`
- `404 SESSION_NOT_IN_REPORT_CASE`
- `409 REPORT_CASE_NOT_OPEN`

## Retention

The scene is deleted `max(retention snapshot, whiteboard.retentionDays)` days after `endAt` unless a report on
the Session is open (spec 021 D10). Each save raises the snapshot to the longest paid plan of either participant
(Creator 180, Pro 365 by default); Free adds nothing, so a Free-only board keeps the config value (default 30).
The participant `GET` returns that effective `retentionDays` once the Session has ended, and `null` before or
when there is no board. After deletion both reads return `revision 0` and `sceneData null`.

## Client flow

1. Open the board: `GET` it, load `sceneData`, remember `revision`.
2. Sync strokes peer-to-peer over the DataChannel. Debounce saves (5–8 s, plus when the board closes or the user leaves) with `PUT expectedRevision = revision`.
3. On `WHITEBOARD_REVISION_CONFLICT`: `GET`, merge elements by `version`/`versionNonce`, then `PUT` again with the new revision.
4. On `WHITEBOARD_READ_ONLY`, or when `readOnly` is true, switch Excalidraw to `viewModeEnabled`. Use `editableFrom`/`editableUntil` to show when editing opens or closes.

Strip non-serialisable `appState` fields (for example `collaborators`) before saving.
