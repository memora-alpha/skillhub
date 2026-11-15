# Validation: Admin Operations and API Hardening

**Started from revision**: `b7295685`

## Local evidence

- Admin reporting-window, DST, cursor, privacy and rate-limit tests: 12 passed.
- `eslint . --max-warnings 0`: passed after implementation.
- `tsc --noEmit`: passed after implementation.
- `nest build`: passed after implementation.
- Repository CD controls: 18 passed after adding the Codex auto-fix workflow.
- Administration now composes exported owner-reader ports from Users, Payments,
  Credit, Reports, Learning Paths, Verifications and Skills; administrative readers no
  longer issue cross-owner Prisma queries directly.
- The work-item and learning-path integration entries use isolated, migrated PostgreSQL
  schemas. They seed every authoritative work kind, audited detail reads, valid skill
  evidence bindings and two historical plan/session versions.
- Redis failure is fail-closed; 429 responses expose bounded retry headers without raw
  device identifiers or User-Agent values.

## Remote evidence

- API CI run
  [`43674413294`](https://github.com/memora-alpha/skillhub/actions/runs/43674413294)
  passed at revision `f47d8c6e`: locked install, disposable PostgreSQL/MongoDB stores,
  Prisma generation, lint, typecheck, build, repository hooks/CD controls, 362 API
  regressions (361 passed, one intentional skip), 64 connection integration tests,
  six settlement/serialization regressions and the release-image build.
- The focused PostgreSQL run emitted query-plan evidence below the 1,000 ms guard:
  admin learning-path list `0.042 ms`, payment review queue `0.048 ms`, and report-case
  queue `0.050 ms` execution time.
- SonarCloud check
  [`132691463354`](https://sonarcloud.io/dashboard?id=memora-alpha_skillhub&pullRequest=103)
  completed on revision `f47d8c6e` with `Quality Gate passed`, zero security hotspots
  and 0.0% new-code duplication. The analysis reports 14 open new-code issues and 0.0%
  new-code coverage; neither condition failed the repository's configured Quality Gate.
- Vercel and Vercel Preview Comments passed on revision `f47d8c6e`; Vercel correctly
  reported the backend-only change as not affecting a deployment.
- The Codex auto-fix workflow separates read-only patch generation from write-capable
  PR publication, pins action commit SHAs, rejects forked heads and never executes the
  failed commit in the publisher job.
- T010 is satisfied by the accepted `dev` Admin Dashboard implementation and its
  substantive isolated PostgreSQL fixture in `test/admin-dashboard.integration.test.mjs`.

## Rollback and remaining operator setup

- Spec 017 adds no Prisma model or migration. A schema rollback rehearsal is therefore
  not applicable to this feature: rollback is an application-code revert of additive
  endpoints/readers and limiter configuration. The two migration files present in the
  PR diff belong to Spec 016 and retain their separate rollout/rollback gate in
  `specs/016-material-reviews-thumbnails/validation.md`.
- Codex auto-fix is checked in but cannot run until `OPENAI_API_KEY` is added as a
  repository or organization Actions secret. The current CLI credential cannot inspect
  the repository setting that allows GitHub Actions to create pull requests, so an owner
  must verify that setting before the first failure-triggered run.
