# SonarCloud PR #8 remediation

Reviewed the 23 Open/Confirmed findings for [PR #8](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&pullRequest=8&issueStatuses=OPEN%2CCONFIRMED)
at commit `03b665f59eab9e99482909e432933251d3e9bd99` on 2026-10-08.
That analysis failed Reliability (D) and Security (C); new-code duplication was 0.0%.

## Code changes

| Finding group                            |  Count | Resolution                                                                                                         |
| ---------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------ |
| Missing sort comparator                  |      1 | Explicit comparator for evidence UUIDs; the fixture migration list also uses an explicit comparator.               |
| Nested ternary                           |      4 | Direct branches or intermediate filters preserve null/undefined, archive, visibility and catalog-status semantics. |
| Optional chaining                        |      3 | Preserve file ownership/resource checks and 404 behavior.                                                          |
| `async` without `await`                  |      1 | Return the existing pending-count promise directly.                                                                |
| `replaceAll`, `startsWith`, `String.raw` |      3 | Preserve Vietnamese slug normalization, migration filtering and literal LIKE escaping.                             |
| Empty Error messages                     |      2 | Explain malformed/oversized cursors while retaining the public `INVALID_CURSOR` response.                          |
| **Total targeted by code**               | **14** | A published revision and fresh Sonar analysis are required to verify closure.                                      |

## Reviewed findings retained in code

Two findings are False Positive:

- `AaEXUHDoDc8KY00o5ytt` (`javascript:S2068`, test helper line 167 in the analyzed revision):
  `fixture-hash` is a deliberately invalid test-only hash placeholder. Fixture accounts
  authenticate through directly issued session tokens; it is not a real embedded credential.
- `AaEXUHH4Dc8KY00o5yt1` (commandJson line 18): the JSON round trip is deliberate
  serialization/normalization. It removes undefined optional fields before idempotency
  canonicalization; `structuredClone` retains them and changes the command contract.

Seven findings are Accepted:

- `AaEXUHHlDc8KY00o5ytw`, `AaEXUHHlDc8KY00o5ytx`, `AaEXUHHlDc8KY00o5yty`:
  sequential file row locks and binding/evidence writes use one transaction connection.
  Batches are bounded to five files. Parallelizing these awaits does not preserve
  ordered locking and binding-before-evidence behavior.
- `AaEXUHDoDc8KY00o5ytq`, `AaEXUHDoDc8KY00o5ytr`, `AaEXUHDoDc8KY00o5yts`:
  migrations and the pre-Skills hook must complete in chronological order because
  later migrations and collision/backfill tests depend on the preceding schema.
- `AaEXUHJqDc8KY00o5yt_`: `PENDING` appears in independent PostgreSQL preflight,
  partial-index and CHECK expressions. A migration-local constant cannot be shared
  by persistent index predicates/constraints without changing their definition.

These classifications are recorded on SonarCloud with rationale. No rule, quality
gate or source exclusion was disabled.

The refreshed Sonar summary confirms 14 Open/Confirmed findings and 7 Accepted
findings. The Security gate condition is cleared; Reliability D remains the sole
failed condition on the unchanged published commit `03b665f`.

## Verification

- API ESLint with zero warnings: passed.
- Full TypeScript check (`tsc --noEmit`): passed.
- Prisma generation and Nest build: passed.
- 22 tests passed, zero skipped: Skills policies, real PostgreSQL migration and
  owner/reviewer journeys, file lifecycle, HTTP/Swagger, module bootstrap and
  idempotency canonicalization/replay.
- `git diff --check`: passed.

Post-push Sonar reanalysis of the code changes remains pending.
The scan also reports Python-version, source-encoding and missing referenced
tsconfig warnings; code coverage is not collected. These are separate scanner
configuration concerns, not verified fixes in this remediation.
