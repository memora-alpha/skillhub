# Feature Specification: Session Whiteboard (backend persistence)

**Feature Branch**: `feat/session-whiteboard`

**Created**: 2026-11-25

**Status**: Implemented on branch (backend only): P1–P4. All four await Product Owner approval.

**Input**: Session recording and whiteboard plan (Excalidraw + LiveKit DataChannel,
2026-11-25). This spec covers Phase 1, the whiteboard snapshot API only. Recording
(LiveKit Egress, retention, legal hold) is out of scope: SRS 1.7 does not cover it and
[livekit-sessions.vi.md](../../docs/livekit-sessions.vi.md) states that sessions are not recorded.

## Business constraint

SRS 1.7 M08 covers rooms, tokens and audio/video only and does not mention a whiteboard.
This spec adds no Credit, Reputation, attendance or settlement effect. The whiteboard is
collaboration state between the two participants of a Session.

## Current-state findings

- Real-time drawing runs on the LiveKit DataChannel on the client (topic
  `skillhub.whiteboard.v1`). Tokens already grant `canPublishData`, so the backend has
  no real-time work to do.
- `sessionJoinAccess` (`domain/session.policy.ts`) already defines when participants
  may be in the room.
- The global JSON body limit is 100 kB (`main.ts`), and the error filter exposes
  `details` only through explicit allowlists.

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | One `session_whiteboards` row per Session stores the latest Excalidraw scene `{ elements, appState?, files? }` as JSONB. No history of earlier revisions is kept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D2  | Optimistic locking on `revision`. The first save requires `expectedRevision = 0`. A stale value returns `409 WHITEBOARD_REVISION_CONFLICT` with `details.currentRevision`, and the client reloads, merges and retries. The scene itself is not echoed in the error.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D3  | **Implemented from proposal P1, awaiting PO approval.** The edit window is computed per caller from `livekit.joinWindow` and the new mutable key `whiteboard.editWindow` (`{ teacherPrepare, afterEndMinutes }`, default `true` / `1440`). Both participants edit from the join window opening until `max(join window close, endAt + afterEndMinutes)`. With `teacherPrepare` the teacher may also edit from confirmation. `CANCELLED`, `DISPUTED`, `NO_SHOW` and `MAKEUP_REQUIRED` freeze the board (`SESSION_NOT_EDITABLE`). An open report (`OPEN`, `UNDER_REVIEW`, `NEED_MORE_INFO`) that targets or relates to the Session also freezes it (`SESSION_UNDER_REPORT`), because filing a report does not change the Session status and the board is evidence for P2; it reopens when the report closes and the window is still open. A `COMPLETED` Session stays editable until the grace period ends. Outside the window: `409 WHITEBOARD_READ_ONLY` with `details.reason` (`EDIT_WINDOW_NOT_OPEN` / `EDIT_WINDOW_CLOSED`). A missing key gives `503 WHITEBOARD_POLICY_NOT_READY` on save and a read-only read. |
| D4  | Limits: 2 MiB of UTF-8 JSON (`413 WHITEBOARD_SCENE_TOO_LARGE`) and 20,000 elements with unique ids. Only `id`, `type`, `version`, `versionNonce` and `isDeleted` are validated; other element fields pass through untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D5  | Only the 2 MiB body parser is scoped to `/api/v1/sessions/:sessionId/whiteboard`. Every other route keeps the 100 kB limit. `express@5.2.1` is declared on `api` because `main.ts` now imports `json` from it; this is the version `@nestjs/platform-express` already resolves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D6  | Reads need `session:read:participant`. Saves need the new `session-whiteboard:update:participant`, granted to USER. Both also require Session membership. Staff/Admin read only through P2 below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D7  | Saves are not audited (they are frequent collaboration state, not decisions), and whiteboard text is not moderated. The board stays private between the two participants, the same as in-room chat.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Open questions

- Q1 (D3): Should the board be editable before the join window, so a teacher can prepare it, or after it, so notes can be finished?
- Q2: Should Staff be able to read the board when a report is open on that Session (`report:moderate`)?
- Q3: Data retention: currently the scene is kept for as long as the Session row exists.

## Proposed answers (awaiting PO approval)

- P1 (Q1/D3, implemented): The teacher may edit alone from CONFIRMED until the join window opens; the learner can only read.
  Both participants edit inside the join window, and for 24 hours after `endAt`. After that the board is read-only
  for good. A cancelled Session is read-only. The limits come from a new config key, `whiteboard.editWindow`
  (`teacherPrepare = true`, `afterEndMinutes = 1440`).
- P2 (Q2, implemented): Staff with `report:moderate` may read the board, but never edit it, while a report on that Session is open.
  Each Staff read is audited.
  - Route: `GET /sessions/:sessionId/whiteboard/staff-review?caseId=`.
  - The caller needs `report:moderate`, the STAFF or ADMIN role, and must be the case `handlerId`. This mirrors
    `staffEvidenceDownload`.
  - The case must be `OPEN`, `UNDER_REVIEW` or `NEED_MORE_INFO`. It must target the Session (`targetType = SESSION`)
    or point at it through `relatedSessionId`.
  - Each read writes `REPORT_EVIDENCE_READ` (target `SESSION_WHITEBOARD`) in the same transaction. A refused read
    writes no audit entry.
- P3 (Q3, implemented): The scene is deleted 30 days after the Session ends. Deletion waits while a report on that
  Session is open, which acts as a simple legal hold. Users cannot delete the board themselves, because it belongs to
  both participants.
  - Config key `whiteboard.retentionDays`: default 30, mutable, range 8–3650. The minimum outlasts the longest edit
    window, so a deleted board can no longer be saved.
  - `SessionWhiteboardRetentionWorker` runs hourly and pages through boards by `sessionId`. Held rows never stall the
    sweep. Each page runs in one Serializable transaction, so a report filed at the same moment either holds the row or
    retries the page.
  - After deletion, `GET` returns `revision 0` and `sceneData null`, still read-only. Deletion writes no audit entry,
    only a log count.
- P4 (D7, decided): There is no moderation in the first release. The fallback is a Session report together with P2.
- Recording stays out of scope until the SRS is amended.
