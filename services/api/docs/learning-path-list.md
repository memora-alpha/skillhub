# Learning Path list title — 2026-11-06

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

The page remains scoped to the caller as participant and ordered by
`createdAt DESC, id DESC`. Cursor format, limit and pagination are unchanged.
Only selected page conversation IDs are loaded in one batched title query,
independently filtered by the viewer's conversation membership. Empty lists do
not query titles. No migration, seed or environment variable is needed for title.
Frontend/mobile changes are outside this API-only update.

Constitution Check: Pass for API scope, owner contract (`ConversationMembershipReader`),
title-only authorization and additive response. PostgreSQL remains authority;
there are no writes, cross-store events or new transaction boundaries. Focused
read/HTTP/Swagger and existing learning-platform regression tests verify the
projection and pagination. Real PostgreSQL verification remains pending the
isolated test database.

Local verification (2026-11-06): all 7 Learning Path read/HTTP/Swagger tests and 52
learning-platform phase tests pass, within the combined 86/86 regression run.
API lint, typecheck and Nest build also pass. No database deployment was performed.
