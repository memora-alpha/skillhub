# SH-003 validation

Date: 2026-10-05. Status: audit framework implemented with one real consumer
(SH-006 configuration update) and verified on PostgreSQL 17.11 (Docker Compose,
isolated database `skillhub_test`). The backlog DoD ("every sensitive
credit/admin/staff action has an AuditLog") is **not met**: credit, moderation
and account consumers do not exist yet.

## Implemented

- Action catalog with strict per-action `before`/`after` projections. Unknown
  fields, including password/OTP/token/signed-URL shaped ones, are rejected and
  never echoed. Reason is trimmed and counted in code points: 1–2,000 in
  general, 10–500 for `VERIFY_SKILL_REJECT`.
- `AuditWriter.validate` / `append(tx, input)`: insert-only through the
  caller's transaction, backend-generated `auditId`, database `created_at`.
  `AuditModule` exports the writer only.
- `audit_logs` rejects UPDATE, DELETE and TRUNCATE by trigger. Actor is a UUID
  snapshot without a foreign key to a User table.
- `auditActorFromActor(actor)`: the only mapping from a verified `Actor`.
- Consumer: `UpdateConfigurationUseCase` writes config, revision and audit in
  one transaction.

## Checks run (API workspace, 2026-10-05)

| Check                                            | Result    |
| ------------------------------------------------ | --------- |
| `pnpm build`, `tsc --noEmit`, `pnpm lint`        | Pass      |
| `pnpm test:audit` (policy, writer, HTTP fixture) | Pass, 9/9 |
| `pnpm test:audit:integration` (PostgreSQL)       | Pass, 7/7 |

What the integration suite proved on PostgreSQL:

- Audit rows get a database UTC instant; UPDATE, DELETE and TRUNCATE are
  rejected; a failed audit insert rolls back the caller's mutation.
- A role granted only SELECT and INSERT on `audit_logs` has no UPDATE, DELETE
  or TRUNCATE privilege (test role `skillhub_test_app`, created for this run).
- Consumer gate: a configuration update commits the current row, the revision
  and the audit row (trimmed reason, server-read `before`/`after`) together;
  two updates with one expected version commit exactly once; a failure after
  the audit insert leaves none of the three.
- Idempotent sensitive command: a failed attempt leaves no audit, outbox event
  or claim; a replay adds no second audit; a different command gets 409.

`audit-http.test.mjs` is a fixture controller behind the real `PermissionGuard`:
missing permission is 403 and blank/missing reason is 400, both before any
mutation; `actorId`, `role` and `actor` sent in the body do not reach the audit
row. Its bearer values are not production authentication.

## Fixed during validation

The raw INSERT fixture in `audit-persistence.test.mjs` omitted the NOT NULL
`actor_roles` column and failed on its first real run. The fixture now writes
`'{}'`, as the repository does for SYSTEM actors. Schema unchanged.

## Still pending

| Task | Pending evidence                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 3    | The same cases with real JWT identities once SH-012 exists.                                                                           |
| 4    | Separate migration/application roles in a deployed database. A DBA or table owner can still disable the triggers; not prevented here. |
| 4    | Every other consumer in the adoption list below.                                                                                      |

Audit rows created by the integration tests stay in the test database
(append-only by design).

## Adoption checklist for consumers

For SH-016/022/025/032/082/091/093/100–105/114/124, each consumer spec must
state: the action code, reason bounds, the `before`/`after` projection, and that
`validate` runs before the mutation and `append` runs in the same transaction.
Audit read API and retention belong to their own features.
