# Foundation validation

Date: 2026-10-03. Results describe the verified foundation revision; each
checkout must configure its own services and repeat the relevant checks.

## Verified

- API lint, TypeScript check and Nest build.
- Prisma schema validation and client generation.
- Five foundation tests covering invalid configuration, secret-safe HTTP errors,
  validation status and readiness failures with mocked dependencies.
- Docker Compose configuration validation.
- Foundation migration 20261003000000_foundation applied to PostgreSQL.
- Live PostgreSQL query and migration/table verification, MongoDB admin ping,
  and Redis PING/PONG using the application drivers.
- API /api/health and /api/health/ready returned HTTP 200; readiness included
  PostgreSQL, MongoDB and Redis. Swagger /api/docs returned HTTP 200.
- Six commit scope tests and six accepted/rejected commitlint message cases.
- Husky pre-commit and commit-msg configuration, and affected file formatting.

## Remaining verification

- BullMQ job execution, retries and recovery against running Redis.
- Graceful API shutdown with live dependencies.
- Business authentication, chat, ledger and provider flows as their features
  are implemented. They are outside the current foundation.

## Repeat on a development checkout

Configure services/api/.env using .env.example, provision the PostgreSQL database
and start PostgreSQL, MongoDB and Redis. From services/api, run:

```powershell
pnpm db:validate
pnpm db:deploy
pnpm exec prisma migrate status
pnpm lint
pnpm check-types
pnpm build
pnpm test:foundation
pnpm dev
```

Check /api/health, /api/health/ready and /api/docs while the API is running.
Readiness queries PostgreSQL and pings MongoDB/Redis; container status or mocked
tests alone do not establish application connectivity.

From the repository root, run pnpm test:commitlint. Git hook checks do not
replace API typecheck, build or behavioral tests.
