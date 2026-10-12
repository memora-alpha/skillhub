# PR #21 Sonar remediation

Scope: `ci/api-cd`, API release scripts and Dockerfile. Published snapshot:
2026-10-13 01:53 +07, commit `5613b3b9c0acd353a907d04569c0b739cc798f4b`.
[Sonar summary](https://sonarcloud.io/dashboard?id=memora-alpha_skillhub&pullRequest=21)
reported 12 OPEN findings: 1 MINOR vulnerability and 11 code smells. The only
failed gate condition was Security Rating B (required A); new-code duplication
was 0%, Reliability A and Maintainability A.

| Rule | Count | Remediation |
| --- | --- | --- |
| `javascript:S4036` | 1 | Use fixed `/usr/bin/docker` and child `PATH=/usr/bin:/bin`; require a root-owned Docker CLI on the Linux runner. |
| `javascript:S3776` | 2 | Separate deployment probes, readiness probes, request history, seed execution and completion recording. |
| `javascript:S9382` | 7 | Bounded polling performs one probe and delay before retrying. Seed commands and seed requests form ordered promise chains, with each marker persisted before the next request. |
| `javascript:S1788` | 1 | HTTP method/body are an options object, with its default argument last. |
| `docker:S7018` | 1 | Sort builder packages as `g++ make python3`. |

No rule exclusions, `NOSONAR`, cloud dispositions or changes to web/mobile were
introduced. Migration/index/seed ordering, seed defaults, persisted request IDs,
image digest validation and release-lock failure behavior remain intact.

## Local verification

- 16 CD tests passed. New cases verify Docker executable search isolation, seed
  non-overlap, completion markers before subsequent requests, retry after a later
  request fails, polling delays/transient failures and validation before mutation.
- API lint and CD JavaScript lint passed.
- Local SonarJS 3.0.5 with TypeScript 6.0.3 checks the three production scripts for
  Cognitive Complexity <=15. ESLint checks `no-await-in-loop` and
  `default-param-last` for those scripts. These are a subset of the cloud analyzer.
- Formatting, whitespace and workflow actionlint checks passed.
- No real database migrations/seeds, Docker release or Coolify deployment ran.
  Linux Docker/image validation remains pending while the local engine is unavailable.
- A fresh published analysis after an authorized commit/push is required to confirm
  the cloud gate; local tests do not establish the published Quality Gate.

## Analysis warnings

The snapshot also reported file-encoding and unresolved-tsconfig warnings.
All tracked non-binary files decoded as strict UTF-8 locally. The inherited
`.sonarcloud.properties` already sets `sonar.sourceEncoding=UTF-8`; automatic
analysis reads this configuration from the repository default branch.
The API tsconfig uses a relative shared-config path. Web/mobile still reference
dependency-provided configs. Scanner logs are needed to identify the precise
unresolved config/file; their sources were not changed or excluded to hide warnings.
Warning clearance remains pending a fresh scan and scanner diagnostics.

References: [automatic analysis configuration](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis)
and the published PR snapshot linked above.
