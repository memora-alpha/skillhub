# Restore amendment

User requested restoration of archived Skills after reviewing the existing terminal archive flow. This amendment replaces that API restriction for catalog and Sharing Skills. It preserves the original records, references and verification history. Scope: backend only.

## Catalog

An active operator needs `skill-catalog:restore`. Default: ADMIN; STAFF needs an explicit grant. List archived records with `GET /api/v1/admin/skills?status=ARCHIVED` and use the returned version.

```http
POST /api/v1/admin/skills/{skillId}/restore
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-command-key>
Content-Type: application/json

{
  "expectedVersion": 2,
  "status": "ACTIVE",
  "reason": "Restore this skill to the catalog"
}
```

`status` is required and accepts ACTIVE or INACTIVE. INACTIVE keeps the skill out of public catalog/search until a later authorized PATCH sets ACTIVE. Restore keeps ID/name/slug/category and all references. It does not restore individually archived Sharing Skills or reopen Requests/Proposals/other lifecycle records. Existing unarchived visible Sharing Skills become discoverable again when the catalog becomes ACTIVE, subject to current account and search rules.

## Sharing Skill

The active owner needs `sharing-skill:restore:self` (default USER/STAFF/ADMIN, own records only). List original records with `GET /api/v1/me/skills?includeArchived=true`.

```http
POST /api/v1/me/skills/{sharingSkillId}/restore
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-command-key>
Content-Type: application/json

{
  "expectedVersion": 4
}
```

The catalog must currently be ACTIVE and the owner must have no other unarchived Sharing Skill for that skillId. If a replacement exists, archive the replacement before restoring the original. Restore sets archivedAt to null and increments version once; level, description, experienceYears, visibility and current verification status are preserved. Evidence revoked during archive remains revoked; restore cannot turn it back into an approval. A hidden skill stays hidden; owner can subsequently PATCH isVisible. The users-owned verifiedSkillCount is recomputed in the same transaction, including restored VERIFIED skills even if hidden.

## Consistency and access

Both commands return HTTP 200 with the existing success envelope and current owner/catalog DTO. expectedVersion is required, integer >=1. Unknown inputs are rejected. Catalog reason is trimmed and must have 1–2000 characters. Owner restore records the fixed audit reason `Owner restored sharing skill`.

Live session, permission and restrictions are rechecked inside the transaction, including successful idempotent replays. Same key and body do not restore twice or duplicate audit; the response hydrates the current record. A key reused with a different command returns 409. A fresh key against an already restored record returns 409. Locks follow user/session → catalog → SharingSkill. The existing partial unique index and user lock serialize restore/create conflicts; two archived versions cannot both become current. State/version, counter, audit and idempotency completion commit or roll back together.

| HTTP | Case                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 400  | Missing Idempotency-Key, invalid version/status/reason or unknown input                                                            |
| 401  | Invalid/revoked session or inactive account                                                                                        |
| 403  | Missing permission or current restriction blocks restore                                                                           |
| 404  | Record missing or Sharing Skill belongs to another owner                                                                           |
| 409  | STALE_VERSION, SKILL_NOT_ARCHIVED, SHARING_SKILL_NOT_ARCHIVED, SKILL_NOT_ACTIVE, SKILL_DUPLICATE, different payload under same key |

PATCH still rejects archived records. No schema change or migration is needed. Run the existing idempotent `pnpm --filter api identity:seed` during rollout to add the new permission codes/default grants; this task does not seed or modify application data. Existing assignments/restrictions are retained by the seed. Audit actions: SKILL_CATALOG_RESTORE and SHARING_SKILL_RESTORE, with allowlisted before/after state.

## Validation

`test/skills/restore.test.mjs` verifies real PostgreSQL state, retained verification history, revoked evidence, duplicate/race conflicts, version checks, replay authorization and audit-failure rollback. `test/skills/http.test.mjs` covers actual guarded HTTP routes, envelope, DTO rejection and Swagger. `test/skills/bootstrap.test.mjs` checks AuditModule wiring. Run API lint, check-types, build, Skills integration and affected audit/RBAC regressions. Results and any remaining limitations are recorded in [validation.md](validation.md).
