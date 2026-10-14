# Per-skill level catalog amendment

The user requested Admin-managed levels for each Skill, selectable when a user
creates or edits a Sharing Skill. This extends the SRS 1.6 fixed Sharing Skill
level enum. Scope: backend, including public/profile and Learning Request offered
Sharing Skill projections. Learning Request `currentLevel` keeps its separate
learning-progress enum. Web/mobile implementation is outside this amendment.

## Behavior and data

`SkillLevel` belongs to exactly one Skill and has UUID id, immutable uppercase
code (1–40 ASCII letters/digits/underscore/hyphen; first character alphanumeric),
name (2–100 characters), nullable description (up to 500), sortOrder (integer
0–100000), ACTIVE/INACTIVE status, optimistic version, and UTC timestamps.
Code and normalized name are unique within a skill. Lists sort by sortOrder then
id. Same order values are allowed. No hard-delete endpoint is exposed.

New Skills receive BEGINNER, INTERMEDIATE, ADVANCED, EXPERT with English display
names for compatibility; Admin may rename or deactivate them and add custom
levels such as CEFR B2 or JLPT N3. Inactive/archived Skills are not exposed through
public level lookup. Admin may view all levels, but cannot edit an archived Skill.
All levels may be inactive; new selections then fail until Admin activates one.

Creation and explicit changes of a user's level require an ACTIVE level belonging
to their selected ACTIVE skill. A composite foreign key additionally prevents
cross-skill level references. Inactivation preserves existing Sharing Skills and
verification/evidence history; it does not unpublish them. Editing other profile
fields and restoring an archived Sharing Skill retain its existing selection.
Selecting a level is self-reported and never grants verification.

## HTTP contract

All paths below start with `/api/v1`. Responses use the existing success/error
envelopes. Lists return `data: SkillLevel[]`, ordered without pagination.

| Method/path                                      | Authorization                | Behavior                                              |
| ------------------------------------------------ | ---------------------------- | ----------------------------------------------------- |
| GET `/skills/{skillId}/levels`                   | Public                       | ACTIVE levels of an ACTIVE skill                      |
| GET `/admin/skills/{skillId}/levels`             | ADMIN + `skill-level:manage` | All levels, including INACTIVE                        |
| POST `/admin/skills/{skillId}/levels`            | Same                         | Add a level                                           |
| PATCH `/admin/skills/{skillId}/levels/{levelId}` | Same                         | Update display fields/status/order; code is immutable |

Both mutations require `Idempotency-Key` and trimmed `reason` (1–2000 chars).
POST requires code/name/sortOrder/status; description is optional and nullable.
PATCH requires expectedVersion (integer >=1) and at least one change; description
may be cleared with null, while name/order/status cannot. Unknown input is rejected.

Example create:

```json
{
  "code": "B2",
  "name": "Upper intermediate",
  "description": "Discuss concrete and abstract topics independently",
  "sortOrder": 20,
  "status": "ACTIVE",
  "reason": "Add CEFR levels for English"
}
```

`POST /me/skills` accepts exactly one of `levelId` or the deprecated legacy `level`
enum. `PATCH /me/skills/{id}` may omit both to retain the selection, or supply
exactly one to change it. Legacy input resolves the matching ACTIVE catalog code.
The existing expectedVersion and idempotency rules continue to apply.

Sharing Skill responses (own/public/search and offered Sharing Skills in Learning
Requests) include `levelId`, `skillLevel` (catalog object), and `level` (catalog code).
**Consumer change:** `level` is now an open string, so custom skills may return
`B2`, `N3`, etc. Clients must render `skillLevel.name` and fetch level choices
instead of assuming four enum values. Old data written outside the new API may
temporarily return null levelId/skillLevel and its legacy enum code.

| HTTP    | Meaning                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| 400     | Malformed/unknown fields, empty patch, missing key, missing or conflicting selection                               |
| 401/403 | Invalid session, inactive account, missing permission, non-Admin or restriction                                    |
| 404     | Missing skill/level, level from another skill, nonpublic skill                                                     |
| 409     | Duplicate code/name, STALE_VERSION, SKILL_ARCHIVED, SKILL_NOT_ACTIVE, SKILL_LEVEL_NOT_ACTIVE, idempotency conflict |

## Consistency and architecture check

- PostgreSQL owns catalog and selections. Skills owns level validation/writes;
  Sharing Skills calls the exported Skills service to select a level.
- Commands recheck live session, ADMIN role, permission and restrictions,
  including successful replays. Default grants add `skill-level:manage` to ADMIN.
- Lock order: user/session, parent Skill, Sharing Skill if applicable. All level
  edits and new selections take the parent lock, serializing deactivation races.
- Level write/version, allowlisted before/after audit (`SKILL_LEVEL_UPDATE`) and
  idempotency completion commit atomically. Duplicate writes roll back. Code is
  immutable; labels are current catalog metadata, not historical snapshots.
- Existing support for an array success schema is extended without changing
  other endpoint behavior. Affected consumers: public profiles/search and Learning
  Request offered-skill responses; their Swagger contracts allow dynamic codes.

## Migration and rollout

1. Deploy `20261014000000_skill_level_catalog` with the normal migration process.
   It seeds four defaults for every existing Skill and backfills levelId on every
   existing Sharing Skill, including archived rows. IDs/history are retained.
2. Deploy API and rerun `pnpm --filter api identity:seed` to add Admin grants.
3. Update web/mobile clients to read catalog choices and submit levelId before
   enabling custom codes for users whose clients assume a fixed enum.

This is an expand migration: old enum `level` is nullable and retained for legacy
requests handled by the new API; `levelId` is nullable in SQL for compatibility, with a constraint requiring
at least one selection. Every new API write resolves levelId; legacy enum is null
for custom codes and populated for the four old codes. No application database
migration/seed is executed as part of source implementation. Removing the legacy
column or enforcing SQL NOT NULL is a separate rollout after old writers migrate.
Deploy the migration and new API together; running an old API binary against
backfilled rows can update the old enum without synchronizing levelId and is not
supported. External imports must supply a matching levelId after rollout.

## Validation

`test/skills/levels.test.mjs` exercises real PostgreSQL and guarded HTTP: permissions,
input validation, Swagger, defaults/legacy selection, cross-skill FK, inactive
history, version conflicts, idempotency/replay authorization, concurrent edits,
and audit-failure rollback. Existing migration/Skills/profile/offering/audit/RBAC
checks remain required. Record actual command results and limitations in
`validation.md`; source completion does not establish production rollout.
