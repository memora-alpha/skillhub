# Implementation Plan: Admin Operations and API Hardening

**Branch**: `feat/admin-observability-hardening` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

Add read-only Admin dashboard, operational work queue, and learning-path projections
over existing module-owned PostgreSQL state. Harden request identity and throttling with
explicit proxy trust and layered keys. The admin module composes exported readers; it
does not bypass owning modules or create new financial definitions.

## Technical Context

**Language/Version**: TypeScript 6, NestJS 11, Prisma 7

**Primary Dependencies**: Existing administration, users, learning-paths, reports,
payments, credit, skills/tags, audit, Redis and request-context modules

**Storage**: PostgreSQL authoritative state; Redis for rate counters

**Testing**: Node test runner with unit/HTTP suites and isolated PostgreSQL integration

**Target Platform**: SkillHub API service

**Project Type**: Modular backend web service

**Performance Goals**: Bounded aggregate queries, no per-row module/profile reads,
cursor pages of at most 100 items, one captured `asOf` per dashboard response

**Constraints**: Additive contracts, no new financial arithmetic, privacy-safe logs,
proxy trust disabled by default, partial source failures must be explicit

**Scale/Scope**: Six new read endpoints, layered limiter policy, and backend QA backlog
SH-120–125/127–128

## Constitution Check

| Area                 | Status         | Design evidence                                                                         |
| -------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Backend scope        | Pass           | Only `services/api` source/spec/test paths.                                             |
| Module ownership     | Pass (planned) | Admin composition uses module-owned readers; writes remain with owners.                 |
| Authoritative stores | Pass           | PostgreSQL facts and Redis counters retain existing ownership.                          |
| Atomicity            | Not applicable | Dashboard/work projections are reads; detail audit is appended through AuditModule.     |
| Security/privacy     | Pass (planned) | ADMIN-only permissions, safe projections, validated proxy hops, hashed device fallback. |
| API contracts        | Pass (planned) | UTC instants, IANA timezone, cursor pagination, availability envelope.                  |
| Delivery reliability | Not applicable | No new webhook/job workflow.                                                            |
| Verification         | Pending        | Focused unit/HTTP/PostgreSQL, rate-limit and QA suites are tasks.                       |
| Git workflow         | Pass           | Branch and commit conventions follow constitution v1.2.0.                               |

No exception is requested. Recheck after implementation; verification remains pending
until runtime suites and a fresh analysis complete.

## Metric dictionary

- Capture database `asOf` once. Interpret all windows as `[from,to)` and derive local
  calendar-day UTC boundaries from the validated timezone.
- `totalUsers`/`newUsers`: accounts whose effective role is USER, excluding STAFF/ADMIN;
  include all account statuses and return a status breakdown.
- `activeLearningUsers`: distinct users with valid attendance intervals intersecting
  the period.
- `inProgressPaths`: distinct paths whose learning stage is `LEARNING` at `asOf`.
- `scheduledSessions`: current schedule rows with `startAt` in the period.
- `completedInScheduledCohort`: completed sessions from that exact scheduled cohort.
- Top-up uses posted Credit ledger facts; held Credit is a snapshot at `asOf`; fee uses
  `RECORDED_CREDIT_FEES_AND_MATERIAL_REFUNDS`.
- Top skills use completed sessions in the scheduled cohort and the historical locked
  plan-version skill.

## Architecture and contracts

```text
src/modules/administration/
├── application/services/admin-dashboard.reader.ts
├── application/services/admin-work-items.reader.ts
├── application/services/admin-learning-paths.reader.ts
└── presentation/http/admin-operations.controller.ts

src/shared/auth/
├── identity-throttle.ts
└── request-rate-limit.policy.ts

test/admin-operations*.test.mjs
test/identity/rate-limit*.test.mjs
```

- Dashboard section readers return `{availability:"AVAILABLE",data}` or
  `{availability:"UNAVAILABLE",errorCode}`; only expected source-unavailable failures
  are isolated. Authorization/validation failures fail the whole request.
- Work-item kinds are allowlisted: `PAYMENT_REVIEW`, `SETTLEMENT_REVIEW`,
  `REPORT_CASE`, `REPORT_INCIDENT`, `PATH_TERMINATION`, `SKILL_VERIFICATION`,
  `TAG_REQUEST`. Missing source severity becomes `UNCLASSIFIED`.
- Detail reads call an exported owner reader and append a minimal audit record; they do
  not return evidence bytes, messages, email, tokens, or storage keys.
- Rate limiting uses validated direct/trusted-proxy IP, authenticated user/session when
  present, and optional `X-Device-Id`. During migration, fallback device identity is an
  HMAC of normalized User-Agent and is never logged raw.

## Rollout

1. Add permissions `dashboard:read` and `learning-path:read:admin`, ADMIN-only seed.
2. Ship dashboard summary/trends, then work items, then learning-path projections.
3. Add `TRUST_PROXY_HOPS` validation with default 0 before enabling forwarded-address use.
4. Enable layered limiter groups endpoint-by-endpoint, preserving conservative fail-safe
   behavior for authentication, payment, and upload endpoints.
5. Run the full QA matrix and record provider-dependent checks separately from local
   automated evidence.

## Verification commands

```powershell
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api test:admin-finance
pnpm --filter api test:completion-gaps
pnpm --filter api test:identity
```

PostgreSQL integration suites require an isolated `TEST_DATABASE_URL`.

## Complexity Tracking

No constitutional violation or approved exception.
