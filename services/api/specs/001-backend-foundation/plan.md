# Implementation Plan: Backend foundation

Date: 2026-10-03. Spec: [spec.md](spec.md). Working directory: services/api.

## Accepted technical decisions

| Concern                 | Decision                                                                                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture            | NestJS modular monolith. Modules use presentation/http, application/use-cases/ports, domain and infrastructure/persistence as appropriate, following Memora.                                                                                                         |
| Relational storage      | PostgreSQL, Prisma 7.8 with pg adapter; schema/migrations owned by API. UUID identifiers for domain entities, UTC timestamps.                                                                                                                                        |
| Document storage        | MongoDB 8, Mongoose 8. PostgreSQL owns Conversation and participants; MongoDB will own Message/attachment metadata. Files stay in object storage.                                                                                                                    |
| Transaction boundaries  | Schedule lock, Session creation, both users' Hold, ledger and critical audit use one PostgreSQL transaction context. Adopt explicit locking/version checks and bounded retry per feature.                                                                            |
| Cross-store consistency | No transaction spans PostgreSQL and MongoDB. Use PostgreSQL outbox and idempotent consumers for business-event messages when implemented.                                                                                                                            |
| Credit                  | Integer units; BIGINT columns where appropriate. Serialize large integer balances as decimal strings in JSON contracts. Immutable ledger and unique idempotency keys.                                                                                                |
| Authentication          | Access JWT + rotated/revocable refresh sessions; Argon2id passwords. TTL, issuer/audience and account linking policy will be defined in auth spec.                                                                                                                   |
| Authorization           | USER/STAFF/ADMIN with explicit permissions and ownership/participant checks. JWT alone does not establish current account status/revocation.                                                                                                                         |
| Jobs/cache              | Redis 7+ and BullMQ; connection URI supplied by the development environment. Bounded retries, exponential backoff, idempotent business jobs. Local throttle is per process initially; shared throttle storage required before multiple API instances.                |
| Files                   | S3-compatible adapter; evidence/chat/report private by default. Provider, upload quotas, MIME checking and malware workflow are defined in upload feature.                                                                                                           |
| API                     | /api prefix, Swagger/OpenAPI, class-validator DTOs, reject unknown fields. Memora JSON envelopes: success/message/data/meta?, or success:false/message/statusCode; pagination in meta.pagination. 204 has no body. See spec 002 response amendment dated 2026-10-04. |
| Config                  | Central validated environment, ignored .env, tracked .env.example. Provider secrets become mandatory when each integration is enabled.                                                                                                                               |
| Observability           | Pino JSON logs, sensitive header redaction, liveness/readiness. Metrics/tracing introduced when deployment targets are defined.                                                                                                                                      |
| Tests                   | Unit tests for policies/config/error handling, integration tests on real PostgreSQL/MongoDB/Redis, e2e for permissions and state machines; financial concurrency and rollback tests are mandatory for financial features.                                            |
| Local runtime           | Environment-configured PostgreSQL/MongoDB/Redis endpoints. Optional Compose provides PostgreSQL 17, MongoDB 8 and Redis 7 on localhost ports 5433/27018/6380.                                                                                                        |

## Constitution Check

Reviewed against constitution v1.2.0 on 2026-10-03. This check separates accepted
design from implementation evidence in [validation.md](validation.md).

| Principle                                   | Status and evidence                                                                                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope and modular architecture (1)          | Pass for foundation scope: changes belong to services/api and necessary workspace dependency configuration. Business module layers are introduced with their features.                                                                                            |
| Store ownership and atomic workflows (2, 3) | Pass for design: PostgreSQL owns relational business state, MongoDB owns messages, and Redis supports jobs/cache. Pending implementation of business transactions, ledger and outbox in their feature plans.                                                      |
| Authentication and authorization (4)        | Not applicable to foundation endpoints: auth and resource permissions are future features with accepted design decisions above. Their implementation and behavioral verification remain pending.                                                                  |
| Validation, API contracts and storage (5)   | Pass for static checks of environment validation, HTTP validation and Swagger setup. Live health/readiness and Swagger returned HTTP 200; S3, pagination and BIGINT contracts belong to future features.                                                          |
| Verification (6)                            | Pass for recorded lint, typecheck, build, schema, unit and Compose configuration checks. Live PostgreSQL/MongoDB/Redis, migration and API checks passed; queue behavior and graceful shutdown remain pending. See validation report and tasks.                    |
| Module/data ownership (7)                   | Pass for foundation design: SystemConfiguration is the only current relational model; no cross-module business writes or derived business projections exist. Future features must declare owning modules, contracts and any shared transaction context.           |
| Jobs/webhooks reliability (8)               | Not applicable to current business delivery: foundation configures BullMQ defaults but implements no processors, webhook handlers or outbox. Future integrations must specify authenticity, idempotency, ordering, retries, failure retention and recovery tests. |

No exceptions to accepted principles are introduced. Remaining queue/shutdown checks prevent
claiming the foundation is fully runtime-verified. Recheck this section when its
implementation or validation evidence changes.

Git workflow follows constitution v1.2.0. Root commitlint, Husky and lint-staged
configuration is required because this API shares the root Git repository and
pnpm workspace. Scope validation discovers workspace manifests and uses staged
paths; pre-commit ESLint targets API TypeScript only. These checks support backend
development without adding frontend functionality. Validate the scope rules with
`pnpm test:commitlint` and exercise commitlint with accepted/rejected messages.

## Foundation implementation

- ConfigModule validation, Pino, Helmet, ValidationPipe, Swagger and baseline throttling.
- PrismaService and Mongoose connection lifecycle; RedisService and BullMQ defaults.
- SystemConfiguration metadata table and initial migration only; no settings API
  or domain tables yet. Runtime env configuration remains independent of this table.
- Readiness pings PostgreSQL, MongoDB and Redis. Required storage is available
  before startup completes; reconnect behavior does not bypass readiness.
- Generated Prisma Client is ignored by Git and generated before build/dev/typecheck.

## Local and production limits

Local Compose credentials are development examples, not production secrets.
Compose MongoDB runs standalone because foundation only connects/pings it;
use a replica set if future message flows require MongoDB transactions.
Do not assume backup/restore, production TLS, metrics or secret management
are configured by this local setup. Queue processors and S3 adapters are future work.

## Validation

Run lint, typecheck, build, schema validation, config/error tests and Compose
validation. With Docker available, apply migration, ping both databases, test
API liveness/readiness/OpenAPI and shutdown. Record any unavailable runtime
check separately from static verification.
