# Validation: Admin Operations and API Hardening

**Started from revision**: `b7295685`

## Local evidence

- Admin reporting-window, DST, cursor, privacy and rate-limit tests: 12 passed.
- `eslint . --max-warnings 0`: passed after implementation.
- `tsc --noEmit`: passed after implementation.
- `nest build`: passed after implementation.
- Repository CD controls: 18 passed after adding the Codex auto-fix workflow.
- Redis failure is fail-closed; 429 responses expose bounded retry headers without raw
  device identifiers or User-Agent values.

## Remote evidence

- API CI run
  [`43615682305`](https://github.com/memora-alpha/skillhub/actions/runs/43615682305)
  passed at revision `99de6f33`: locked install, disposable PostgreSQL/MongoDB stores,
  Prisma generation, lint, typecheck, build, repository hooks/CD controls, 342 API
  regressions, connection integration tests, settlement/serialization regressions and
  release-image build.
- SonarCloud check `132512714772` passed on head revision `a52540ec`: reliability,
  security and maintainability ratings are A, new-code duplication is 0.0%, all
  security hotspots are reviewed and no vulnerability remains open.
- Vercel and Vercel Preview Comments passed on head revision `a52540ec`.
- The Codex auto-fix workflow separates read-only patch generation from write-capable
  PR publication, pins action commit SHAs, rejects forked heads and never executes the
  failed commit in the publisher job.

## Remaining release gates

- T004 remains open: move direct administrative source queries behind exported
  owner-module reader ports before declaring the architecture complete.
- T010, T015 and T020 remain open: the checked-in integration entry points still need
  substantive isolated PostgreSQL fixtures for dashboard aggregates, mixed-source work
  items and historical learning-path projections. The passing connection suite does not
  substitute for these feature-specific fixtures.
- T030 remains open only for the feature-specific PostgreSQL suites, performance
  query-plan evidence and migration rollback rehearsal; lint, typecheck, build, the
  broader PostgreSQL/MongoDB suites and fresh Sonar analysis have passed.
- Codex auto-fix is checked in but cannot run until `OPENAI_API_KEY` is added as a
  repository or organization Actions secret. The current CLI credential cannot inspect
  the repository setting that allows GitHub Actions to create pull requests, so an owner
  must verify that setting before the first failure-triggered run.
