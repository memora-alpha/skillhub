# Learning Path list: title and business activity

`GET /api/v1/learning-paths/mine` now includes `title: string | null` on every
`data[]` item, also in the internal `listMine` projection and Swagger summary.

- For a Learning Request conversation, use that request's current stored title,
  including when the request is closed/hidden (historical title-only visibility).
- For direct connections, use the skill name from the source proposal, consistent
  with the Inbox label. No separate editable LearningPath title is introduced.
- Return `null` if source metadata is unavailable to the viewer; never expose
  request bodies, evidence or other private fields through this projection.

Example item (other existing summary fields are retained):

```json
{
  "id": "path UUID",
  "title": "Học tiếng Anh giao tiếp",
  "conversationId": "conversation UUID",
  "status": "PROPOSED",
  "exchangeType": "ONE_WAY"
}
```

The page remains scoped to the caller as participant. As of 2026-11-11 it is
ordered by `lastActivityAt DESC, id DESC`; each item includes `lastActivityAt`.
The opaque cursor binds the viewer, `activity-v1` ordering, activity timestamp
and ID. Legacy creation-time cursors return `400 INVALID_LEARNING_PATH_CURSOR`;
restart from page one. Limits and pagination envelope are unchanged.
Only selected page conversation IDs are loaded in one batched title query,
independently filtered by the viewer's conversation membership. Empty lists do
not query titles. No seed or environment variable is needed. Activity ordering
requires migration `20261111000000_learning_path_activity` before the new API.
Frontend/mobile changes are outside this API-only update.

Activity advances on creation/version changes of plans/schedules, first agreement,
plan and schedule confirmations, and Path lifecycle/settlement-state changes.
PostgreSQL triggers maintain this derived Path projection within the source
transaction using database time. No-op/repeated updates, reads, chat delivery,
fee snapshot writes, attendance heartbeats and technical `updatedAt` changes do
not advance it. Existing Path-before-plan/schedule locks remain unchanged.

Backfill takes the greatest recorded business timestamp from the Path,
agreement/plan/schedule versions and applied session schedule history. It excludes
generic `updatedAt`; historical actions without a stored event timestamp cannot
be reconstructed exactly. It does not assign migration time to every old Path.
Page boundaries retain their original timestamp/ID even if that row moves later;
refresh page one to see newly active rows. This is a live list, not a frozen
snapshot across arbitrary concurrent activity.

See [activity plan and validation](../specs/008-connections/path-activity-plan.md)
for the 2026-11-11 activity projection and rollout.

## Historical title amendment verification (2026-11-06)

Constitution Check: Pass for title-only API scope, owner contract (`ConversationMembershipReader`),
title-only authorization and additive response. PostgreSQL remains authority;
there are no writes, cross-store events or new transaction boundaries. Focused
read/HTTP/Swagger and existing learning-platform regression tests verify the
projection and pagination. Real PostgreSQL verification remains pending the
isolated test database.

Local verification (2026-11-06): all 7 Learning Path read/HTTP/Swagger tests and 52
learning-platform phase tests pass, within the combined 86/86 regression run.
API lint, typecheck and Nest build also pass. No database deployment was performed.
