# SonarCloud PR #20 remediation — 2026-10-12

Verified [PR20 analysis](https://sonarcloud.io/summary/new_code?id=memora-alpha_skillhub&pullRequest=20) against Git HEAD `8853244b6607dd5f33953330790d6661001f79c2`, analyzed at 21:56:27 Asia/Saigon. Analysis ID `459335de-17f6-4aea-a9aa-e48fa021a5af`. The [original issue snapshot](sonar-pr20-findings.json) contains 10 Open findings: four bugs and six code smells.

The gate fails only on new reliability rating D (required A). New-code duplication is 0 lines/0.0%; security and maintainability conditions pass. The cloud still describes the published original revision until the fixes are published and reanalyzed.

## Source remediation

| Rule / issues        | Change                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| typescript:S2871 / 4 | Explicit string comparators for canonical offered IDs in preparation and owner/reviewer projections; the batch offering validator no longer sorts with an implicit comparator. Also fix the same pattern in edit change detection and publish signatures before it recurs. UUID order stays deterministic.                                                               |
| typescript:S3358 / 1 | Separate weekly-availability merge branches from object construction; keep omitted, null and absolute/weekly replacement semantics.                                                                                                                                                                                                                                      |
| typescript:S4144 / 1 | Share the same fail-closed fallback through its existing read method rather than two identical bodies.                                                                                                                                                                                                                                                                   |
| typescript:S9382 / 3 | Replace per-offering snapshot/catalog/sharing awaits with three bounded queries: snapshot → catalog-owned ordered locks/active validation → ordered Sharing Skill locks/revalidation. Ownership, hidden/archive errors and transaction boundaries stay intact; changed selections reject before writing.                                                                 |
| plsql:S1192 / 1      | Proposed False Positive: repeated `weeklySlots` strings are PostgreSQL JSONB key references in a declarative CHECK, not PL/SQL procedural literals. A local variable cannot be captured as a persistent CHECK expression. Keep the published migration unchanged; do not add a helper database function, change source exclusions or rewrite history just for this rule. |

The SQL finding is `AaEwnivCUVrduFYmTBDc`. The local `_prisma_migrations` lookup did not show this migration applied, but that does not prove another environment has not applied the published artifact. No cloud disposition was submitted; the current Sonar browser is logged out. No rules/exclusions/quality gates were disabled and no NOSONAR comment added.

## Analysis warnings

The public Sonar UI confirms three warnings, independent of Quality Gate conditions:

1. Python version is not configured. Add `sonar.python.version=3.12` to the root `.sonarcloud.properties`, matching the bundled Python 3.12.14 used to parse all seven tracked Python generators/tests successfully.
2. Source encoding warning. Declare `sonar.sourceEncoding=UTF-8` in that same file. Strict UTF-8 inspection of tracked text-source extensions found no invalid file in the 973-file tracked inventory; this is not evidence that the scanner warning has disappeared. Scanner file/line details remain unavailable without its logs.
3. Missing referenced/extended tsconfig. The API config extends an installed workspace package; change that inheritance to the same repository-local `../../packages/typescript-config/nestjs.json`. Effective `tsc --showConfig` SHA256 is identical before/after: `b413bac8d09ba24593ee8fe34c096e16640f3cb5a73b115f966a7d12e34c8c60`. No compiler behavior changes. Web and mobile external config inheritance is outside this backend change, so a project-wide warning may remain until those owners act or analysis installs dependencies.

[Official Automatic Analysis configuration](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis) supports source encoding and Python version in `.sonarcloud.properties`, and reads that file from the default branch. It ignores `sonar-project.properties`; no CI scanner was added or automatic scanning disabled. Therefore the configuration additions cannot be declared cloud-verified from this local branch. See [TypeScript configuration guidance](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/languages/javascript-typescript-css) for how the scanner resolves TypeScript configs and source encoding.

## Prevention guidance

`services/api/AGENTS.md` now records sort contracts, PATCH null semantics, exact DTO/Swagger sharing, genuine batching with ordered locks, complexity/transaction boundaries, useful Error messages, PostgreSQL analyzer mismatches and revision/analysis verification. `services/api/CLAUDE.md` already imports `@AGENTS.md`, so the guidance has one source.

Historical API inventory includes 129 findings (42 proposed code changes, 77 proposed Accepted and 10 proposed False Positive): loop-await 63, SQL repeated literals 14, cognitive complexity 9, Error messages 8, optional chaining 8 and nested ternaries 6. These are historical counts, not current defects or this PR's issue count. Their distinction prevents treating every sequential transaction or migration literal as a bug.

## Verification

Final checks against the local fixes passed:

- API build, full API ESLint with zero warnings, and TypeScript `--noEmit`.
- 121 unit/contract tests: Learning Request non-integration suites, Skill policies, the new offering batch regressions, and existing Sonar remediation regressions.
- 16 real PostgreSQL tests: FE request preferences, offering ownership/projection and Tag HTTP/Swagger contracts. The tests used isolated schemas and removed them afterward; no application migration was deployed.
- Effective TypeScript configuration comparison, strict UTF-8 inspection, and Python 3.12 parsing described above.
- Independent review of ownership/race revalidation, catalog-before-sharing lock order, PATCH behavior, fallback behavior and documentation found no actionable defect. `git diff --check` passed.

The new batch tests cover constant query count, deterministic lock ordering, empty/duplicate selections, foreign ownership and inactive/changed/deleted/archived/hidden offerings rejecting before a caller writes. They failed against the original per-ID implementation and passed after batching.

Publishing, Sonar reanalysis and cloud issue dispositions remain separate from local verification. No commit, push or application database migration was performed. The nine code findings are addressed locally; the SQL finding remains a proposed False Positive, and the three analysis warnings require a fresh cloud scan before closure can be claimed.
