# PR #34 Sonar remediation

## Verified cloud snapshot

[PR analysis](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&pullRequest=34)
at 2026-10-16 18:35:32 +07 analyzed
`f480ffee4e4c3f779d75d0b685dca51b3c9df112`, matching the local HEAD before these fixes.
There are three OPEN issues. The Quality Gate is ERROR because new-code Reliability
is E (required A). Security and Maintainability are A, duplication is 1.6% (limit
3%), and reviewed security hotspots are 100%.

## Findings and treatment

| Issue / rule                                                     | Location at analyzed revision                                             | Treatment                                                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AaFEf37kZ-LBfy4sc3KS` / `javascript:S9382`                      | `test/skills/helpers.mjs:80`                                              | Replace loop awaits with an ordered promise chain. A hook runs after preceding migrations, before its own migration; rejection prevents all subsequent hooks and migrations. |
| `AaFEf4A7Z-LBfy4sc3KT` / `plsql:DeleteOrUpdateWithoutWhereCheck` | `prisma/migrations/20261015000000_tag_creation_requests/migration.sql:25` | Proposed **Accepted**: intentional full-table backfill, with the evidence below. No migration edit.                                                                          |
| `AaFEf4A7Z-LBfy4sc3KU` / `plsql:S1192`                           | Same migration, lines 34, 40, 51, 56                                      | Proposed **Accepted**: required PostgreSQL schema literals, with the evidence below. No migration edit.                                                                      |

The migration belongs to the published PR revision. Per
[API guidance](../AGENTS.md#sonar-prevention-and-verification), preserve published
or applied migration history rather than changing its checksum for analyzer findings.
No rule exclusions or `NOSONAR` suppressions were added.

### Full-table UPDATE evidence

The migration first adds nullable `tags.label_key`, then populates it for **every**
legacy tag using `pg_temp.skillhub_tag_key(label)`, and finally sets it NOT NULL
and adds its unique index. All existing rows need this backfill, including inactive
tags; no row predicate is intentionally required. Preflight blocks invalid labels
and normalized collisions before the update. The existing PostgreSQL migration
tests verify legacy identifiers, labels, metadata, status and request links survive,
and verify invalid or colliding legacy rows fail instead of being merged.

### Repeated state literal evidence

`PENDING` is the same domain state in four separate DDL contexts: the enum member,
column default, decision CHECK constraint and partial unique-index predicate.
These declarations must agree. A PL/SQL-style procedural constant cannot be shared
by these PostgreSQL DDL expressions. Replacing it with a runtime function or dynamic
DDL would add dependencies and obscure the schema just to satisfy the analyzer.
The PostgreSQL tests exercise decision metadata constraints and pending-request
uniqueness. Keep the published schema statements intact.

## Analysis warnings

The PR's warnings dialog was inspected directly. It reports file-encoding problems
and at least one missing referenced/extended `tsconfig.json`; it does not name the
affected files. An unauthenticated request for scanner activity returns HTTP 401.

A strict UTF-8 check passed for all 1,253 tracked files without NUL bytes; binary
files were skipped. `.sonarcloud.properties` already sets UTF-8. API tsconfig
inheritance uses repository-relative files; web and mobile inherit dependency
configs. Automatic Analysis reads configuration from the default branch. These
facts do not prove the warning source: scanner logs and a fresh analysis are still
required. No unrelated frontend configuration was changed.

## Verification and cloud follow-up

- API ESLint, TypeScript checking and Nest build passed.
- Focused ESLint with `no-await-in-loop:error` passed for both changed test files.
- 57 PostgreSQL Skills/Tag integration tests passed, with no skipped or failed
  tests. Two new regression cases verify schema visibility at each ordered hook
  and that an asynchronous hook failure prevents later hooks from executing.
- Prettier checks and `git diff --check` passed. The published migration has no
  diff against HEAD; its SHA-256 remains
  `9c0060fb7bda911b69933d3aeb7bc2dbba4a5617111601b92f922179dfd554e2`.
- Tests used a dedicated disposable PostgreSQL container, separate from the
  application's databases.

The two SQL dispositions are proposals only: the available browser session is
logged out and its issue-status controls are disabled. No cloud status was changed.
After an authorized commit/push, analyze the fix revision, apply the reviewed SQL
dispositions using an account with issue-management permission, and recheck the
Quality Gate and warning details. Local checks do not establish cloud closure.
