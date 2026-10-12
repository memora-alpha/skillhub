# SonarCloud PR #6 remediation

Reviewed against the 59 Open/Confirmed new-code issues reported for
[PR #6](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&pullRequest=6&issueStatuses=OPEN%2CCONFIRMED)
at commit `6b2eb4bedd2862181cda7c73f19337ba5d08e9c0`.

| Issue group                     |  Count | Resolution                                                                                    |
| ------------------------------- | -----: | --------------------------------------------------------------------------------------------- |
| Missing sort comparators        |     16 | Explicit string comparators preserve deterministic tag, category, and cursor ordering.        |
| `async` without `await`         |      7 | Return existing promises directly; unavailable dependency methods still reject promises.      |
| Cognitive complexity            |      3 | Split query/edit branching into smaller operations without changing authorization or filters. |
| Nested ternary                  |      7 | Use direct branches or intermediate values.                                                   |
| Duplicate imports               |      8 | Consolidate imports.                                                                          |
| Optional chaining               |      5 | Preserve the same null/version checks.                                                        |
| `includes`, `String.raw`, `.at` |      3 | Use equivalent built-in expressions.                                                          |
| Role lookup in loop             |      1 | Load the three role IDs in one query before grant assignment.                                 |
| **Code changes targeted**       | **50** | Closure requires a fresh Sonar analysis after publishing this branch.                         |

The remaining nine findings are intentionally retained:

- Seven repeated SQL literals define values in distinct PostgreSQL enums. Removing
  them changes the database contract. The `VARCHAR2` recommendation is for Oracle;
  this migration targets PostgreSQL and correctly uses `VARCHAR`.
- The expiry worker awaits each request's independent row-locking transaction.
  Running up to 500 transactions at once would increase pool/lock pressure and
  change failure/backpressure behavior. A bounded concurrency redesign requires
  separate performance evidence.

No Sonar rule, quality gate, source exclusion, or security check is disabled.
Do not report the Quality Gate as passed until the updated PR revision is analyzed.

## Local verification

- `npm.cmd run test:learning-request`: Nest build succeeded; 90/90 tests passed.
- `npm.cmd run lint` and `npm.cmd run check-types`: passed.
- `npm.cmd run test:identity`: 11/11 passed when localhost sockets were
  permitted for its S3, ClamAV, and SMTP test servers.
- `npm.cmd run test:foundation`: 6/6 passed.
- `git diff --check`: passed.

These checks do not replace SonarCloud reanalysis or real PostgreSQL/Redis
integration verification.

## PR #18 duplication follow-up — 2026-10-12

Inspected the live SonarCloud duplication details for PR #18 at `e52659d`:
19 duplicated new lines, 4.2% density, four blocks across two files.

- DTO: create lines 182–200 duplicate edit lines 273–291 (preferred-slot
  validation and nullable expiry). Shared property decorators retain the
  distinct create/edit defaults and descriptions.
- Responses: owner lines 25–50 duplicate moderation lines 162–187 (request
  content). Both responses now inherit that exact common content schema.

Verification: build and lint passed; 93/93 Learning Request tests passed,
including nested-slot and nullable-expiry validation. All 13 generated Swagger
schemas match the pre-change baseline, ignoring object-key and required-array
ordering. A local TypeScript-token comparison using the documented default
100-token/10-line threshold reproduced both baseline pairs and found no remaining
matches involving the two modified files across API source. This supplemental
comparison does not replace SonarCloud's analyzer. Cloud Quality Gate status
requires reanalysis of the published revision.
