# Feature Specification: Session Whiteboard (backend persistence)

**Feature Branch**: `feat/session-whiteboard`

**Created**: 2026-11-25

**Status**: Implemented on branch (backend only). D3 awaits Product Owner confirmation.

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

| ID  | Decision                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | One `session_whiteboards` row per Session stores the latest Excalidraw scene `{ elements, appState?, files? }` as JSONB. No history of earlier revisions is kept.                                                                                                                                                                  |
| D2  | Optimistic locking on `revision`. The first save requires `expectedRevision = 0`. A stale value returns `409 WHITEBOARD_REVISION_CONFLICT` with `details.currentRevision`, and the client reloads, merges and retries. The scene itself is not echoed in the error.                                                                |
| D3  | **Needs PO confirmation.** The board is editable exactly while the room join window is open (`[startAt − early, endAt + late)` on a joinable status, `livekit.joinWindow`). Outside it the board is read-only: `409 WHITEBOARD_READ_ONLY` with `details.reason` set to a join reason code. No new configuration key is introduced. |
| D4  | Limits: 2 MiB of UTF-8 JSON (`413 WHITEBOARD_SCENE_TOO_LARGE`) and 20,000 elements with unique ids. Only `id`, `type`, `version`, `versionNonce` and `isDeleted` are validated; other element fields pass through untouched.                                                                                                       |
| D5  | Only the 2 MiB body parser is scoped to `/api/v1/sessions/:sessionId/whiteboard`. Every other route keeps the 100 kB limit. `express@5.2.1` is declared on `api` because `main.ts` now imports `json` from it; this is the version `@nestjs/platform-express` already resolves.                                                    |
| D6  | Reads need `session:read:participant`. Saves need the new `session-whiteboard:update:participant`, granted to USER. Both also require Session membership. Staff/Admin get no access.                                                                                                                                               |
| D7  | Saves are not audited (they are frequent collaboration state, not decisions), and whiteboard text is not moderated. The board stays private between the two participants, the same as in-room chat.                                                                                                                                |

## Open questions

- Q1 (D3): Should the board be editable before the join window, so a teacher can prepare it, or after it, so notes can be finished?
- Q2: Should Staff be able to read the board when a report is open on that Session (`report:moderate`)?
- Q3: Data retention: currently the scene is kept for as long as the Session row exists.
