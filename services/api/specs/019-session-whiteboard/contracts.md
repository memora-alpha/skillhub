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
  "readOnly": false,
  "readOnlyReason": null,
  "editableFrom": "2026-11-02T09:50:00.000Z",
  "editableUntil": "2026-11-03T11:00:00.000Z"
}
```

`readOnlyReason` ∈ `SESSION_NOT_EDITABLE`, `WHITEBOARD_POLICY_NOT_READY`,
`EDIT_WINDOW_NOT_OPEN`, `EDIT_WINDOW_CLOSED`, or `null`. The edit window is computed for the
caller (`whiteboard.editWindow`, see spec P1):

- `editableFrom`: the join window opening. It is `null` for the teacher when `teacherPrepare` is on,
  because the teacher may edit as soon as the Session is confirmed.
- `editableUntil`: `max(join window close, endAt + afterEndMinutes)`. After it the board is frozen.
- Both are `null` when the Session status freezes the board (`CANCELLED`, `DISPUTED`, `NO_SHOW`,
  `MAKEUP_REQUIRED`) or the configuration is not ready.

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

| Status | message                                                              | details                                                                             |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 400    | validation message / `INVALID_WHITEBOARD_SCENE`                      | —                                                                                   |
| 403    | `SESSION_ACCESS_DENIED`                                              | —                                                                                   |
| 404    | `SESSION_NOT_FOUND`                                                  | —                                                                                   |
| 409    | `WHITEBOARD_REVISION_CONFLICT`                                       | `{ currentRevision }`                                                               |
| 409    | `WHITEBOARD_READ_ONLY`                                               | `{ reason }` (`SESSION_NOT_EDITABLE`, `EDIT_WINDOW_NOT_OPEN`, `EDIT_WINDOW_CLOSED`) |
| 413    | `WHITEBOARD_SCENE_TOO_LARGE` (scene) or a body-parser 413 (raw body) | —                                                                                   |
| 503    | `WHITEBOARD_POLICY_NOT_READY`                                        | —                                                                                   |

## Client flow

1. Open the board: `GET` it, load `sceneData`, remember `revision`.
2. Sync strokes peer-to-peer over the DataChannel. Debounce saves (5–8 s, plus when the board closes or the user leaves) with `PUT expectedRevision = revision`.
3. On `WHITEBOARD_REVISION_CONFLICT`: `GET`, merge elements by `version`/`versionNonce`, then `PUT` again with the new revision.
4. On `WHITEBOARD_READ_ONLY`, or when `readOnly` is true, switch Excalidraw to `viewModeEnabled`. Use `editableFrom`/`editableUntil` to show when editing opens or closes.

Strip non-serialisable `appState` fields (for example `collaborators`) before saving.
