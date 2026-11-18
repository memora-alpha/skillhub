# Web readiness validation

Date: 2026-11-18. Scope: uncommitted changes on `fix/admin-moderation`, API workspace only.

## Evidence

- API lint: passed (`pnpm --filter api lint`). Cached pnpm 10.24.0 was invoked directly because the Corepack shim attempted an unavailable download; no dependency installation or configuration change was needed.
- API typecheck: passed (`pnpm --filter api check-types`, including Prisma generation).
- API build: passed (`pnpm --filter api build`, including Prisma generation).
- Focused requirements regressions: work source queries, source cap and compound cursor ties; live `/me` permissions; contact rejection before side effects; material filters and moderation history; audit access, pagination and projection. Failing tests were observed before implementation, then passed.
- Existing and new identity/RBAC/audit/material/admin/finance/completion unit and HTTP suites: 123 tests passed, no skips. Additional existing chat/idempotency/policy regressions: 11 passed. A further audit Swagger string/null regression was observed failing, fixed with explicit schema types, and verified separately (5 audit tests passed).
- Work-items PostgreSQL integration: passed. Seven authoritative sources, 131 tied tag timestamps, a tie across kinds, both sort directions, literal search and severity/waiting/assignee/age filters.
- Audit PostgreSQL + HTTP integration: passed. Actual issued sessions, ADMIN-only seeded grant, 401/403 handling, all query filters, equal-timestamp pages, strict DTOs, metadata privacy and immediate grant revocation using the same token.
- Full material PostgreSQL integration script: 85 tests passed, no skips. Includes lifecycle/publication-lock, access/purchase/refund, saved lists, covers, reviews, reports and six new web-readiness cases. FREE-library tests include owner, skill and FREE/PAID access filters. The suspected enum parameter issue did not reproduce with PrismaPg; no speculative cast change was made.
- Independent read-only review: no confirmed important or critical findings.
- Whitespace: `git diff --check` passed.

Tests used the existing fixture helpers and randomly named PostgreSQL schemas with cleanup, against local `127.0.0.1:5432`. The sandbox initially rejected local connections; the same isolated tests then passed with reviewed execution permission. No application schema migration, seed, deployment, real email delivery or remote provider integration was performed.

## Contract decisions

- The user explicitly requested contact blocking after clarification on 2026-11-18. The guard covers normalized text patterns, not attachment/OCR or every possible obfuscation.
- Material dates refer to material creation time, with inclusive `from` and exclusive `to`. Owner management rejects `ownerId`; Staff can use `status=ALL` while private drafts remain excluded.
- General audit reading exposes metadata only. Authorized material moderation history projects its own allowlisted decision fields through the Audit module's internal target reader.
- Audit reading requires the new ADMIN-only `audit:read` grant. Run the existing identity seed workflow during rollout; no new migration/env configuration is needed.

The exact FE endpoints, response fields, errors and rollout instructions are in [web API contracts](../../docs/web-api-readiness.md). Frontend implementation, production deployment, cloud analysis and performance/load validation were not part of these checks.
