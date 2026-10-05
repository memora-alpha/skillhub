# Sonar PR #1 remediation

Reviewed on 2026-10-05 against the 42 Open/Confirmed new-code issues in
[PR #1](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&pullRequest=1&sinceLeakPeriod=true&issueStatuses=OPEN%2CCONFIRMED).
Implementation base: merge commit `4de0928`.

## Source changes targeting 26 issues

| Area                                   | Issue count | Result                                                                                                                                                                                                        |
| -------------------------------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Participant locks                      |           2 | A single parameterized PostgreSQL query orders UUID rows before `FOR UPDATE`. Empty inputs do not issue a query. Removes JavaScript sort and per-row query loop while preserving consistent lock acquisition. |
| Role/permission seed                   |           3 | Bulk insert with `skipDuplicates`, then create missing ADMIN permission mappings in the same transaction. Existing descriptions and grants are preserved.                                                     |
| Request guard                          |           1 | One success return after conditional health exemption/throttling. Limit and outage exceptions remain 429/503.                                                                                                 |
| Identity configuration                 |           3 | Extract previous-key loading/validation from constructor and replace bare errors with safe constant messages. Public configuration errors never include secret values.                                        |
| HTTP error filter                      |           2 | Replace nested ternaries with explicit message selection and normalization; retain Memora envelopes, validation messages and generic 5xx messages.                                                            |
| Email masking/cursor errors            |           2 | Replace backtracking regex with delimiter lookup and slicing; add a safe cursor error message.                                                                                                                |
| Null checks                            |           8 | Use optional chaining without changing OTP consumption, account/session checks or ownership semantics.                                                                                                        |
| JWT/image errors                       |           2 | Give internal errors constant diagnostic messages, retaining existing public exceptions.                                                                                                                      |
| OpenAPI OTP pattern                    |           1 | Use `String.raw` for the escaped regex string.                                                                                                                                                                |
| Multer type loading/profile validation |           2 | Load Multer types explicitly in API tsconfig; remove empty type import; use `includes(null)`. Shared tsconfig and frontend are unchanged.                                                                     |
| **Total**                              |      **26** | Source remediation is verified locally; closure must be confirmed by a fresh Sonar analysis after publishing the changes.                                                                                     |

The lock query follows PostgreSQL's sorting-before-locking behavior. UUID IDs
are not updated by identity workflows. See [PostgreSQL SELECT locking](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE).

## Sonar dispositions applied

These dispositions apply to individual reviewed PR issues. No rule, quality gate,
source exclusion or security check was disabled. SQL migration files are unchanged.

### False positive: 10 issues

- Nine `VARCHAR2` recommendations: `AaEGh9RMAqvO3agKeaIV`, `AaEGh9RMAqvO3agKeaIW`,
  `AaEGh9RMAqvO3agKeaIX`, `AaEGh9RMAqvO3agKeaIY`, `AaEGh9RMAqvO3agKeaIZ`,
  `AaEGh9RMAqvO3agKeaIa`, `AaEGh9RMAqvO3agKeaIb`, `AaEGh9RMAqvO3agKeaIc`,
  `AaEGh9RMAqvO3agKeaId`. Datasource is PostgreSQL, where `VARCHAR` is the valid
  type used by the Prisma schema. Applying an Oracle-specific recommendation would
  break the migration. See [PostgreSQL character types](https://www.postgresql.org/docs/17/datatype-character.html).
- Duplicate SQL literal: `AaEGh9RMAqvO3agKeaIe`. `EXPIRED` belongs to three distinct
  enum declarations; the declarations must retain their own values.

### Accepted: 6 issues

Accepted means deliberately retained, not code-fixed or incorrectly detected.

- `AaEGh9PTAqvO3agKeaIJ`: concrete `EmptyDto` provides a Nest ValidationPipe metatype
  that rejects all unknown body properties. A regression test checks empty success
  and injected-field rejection. Removing the DTO would remove this validation boundary.
- `AaEGh9Q_AqvO3agKeaIT`: dimension throttle counters advance sequentially and stop
  at the first exhausted limit. Parallel requests would advance later counters even
  for an already-denied operation. A regression test verifies the short circuit.
- `AaEGh9PnAqvO3agKeaIL`: email reconciliation enqueues a bounded page of jobs
  sequentially, providing backpressure and stopping on provider failure.
- `AaEGh9NkAqvO3agKeaH3`, `AaEGh9NkAqvO3agKeaH4`, `AaEGh9NkAqvO3agKeaH5`:
  avatar reconciliation enqueues/removes a bounded page sequentially. Storage deletion
  must complete before marking an asset DELETED. Sequential processing limits provider
  pressure and retains existing failure/retry behavior. Bulk enqueue or controlled
  concurrency can be a later measured throughput improvement.

Sonar UI confirmed 26 Open/Confirmed issues remaining after applying these
16 dispositions. The remaining 26 are the source changes above, still absent from
the published PR revision. Do not report the quality gate as passed before reanalysis.

## Verification

- API lint, check-types and build passed.
- `test:identity`: 11/11 test entries passed.
- `test:foundation`: 5/5 passed.
- `test:rbac`: 13/13 passed.
- `test:identity:integration`: 17/17 test entries passed on real PostgreSQL/Redis,
  including existing HTTP/Swagger/BullMQ tests, idempotent bulk seed with preserved
  descriptions, and eight concurrent transactions locking reversed/duplicate UUID inputs.
- Total: 46 test entries passed, zero failures or skips.

Three pre-existing analysis warnings remain: Python version defaults, unspecified
file encoding problems and unresolved extended tsconfig during scanning. Local
TypeScript resolution passes; scanner logs are still needed to identify the exact
missing path/encoding problem. No speculative scanner configuration was added.

No new migration, API contract change or business policy was introduced.
