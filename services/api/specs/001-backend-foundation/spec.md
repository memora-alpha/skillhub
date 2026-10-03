# Backend foundation

Date: 2026-10-03. Scope: services/api. The foundation defines modular backend
boundaries, PostgreSQL/Prisma and MongoDB/Mongoose.

## Acceptance scenarios

1. Developer provisions PostgreSQL, MongoDB and Redis using installed services,
   team development servers or Docker Compose,
   generates Prisma Client, applies migrations and starts the API on port 3001.
2. Missing or invalid required configuration fails startup without echoing secrets.
3. Liveness responds at /api/health. Readiness checks all three databases/cache
   and responds 503 when a required dependency is unavailable.
4. Swagger describes implemented endpoints in development. Invalid DTO fields
   are rejected; unexpected errors do not expose stack traces or credentials.
5. Core relational state and financial transactions belong to PostgreSQL.
   MongoDB stores chat messages in future features, not balances or participants.
6. Codex and Claude read the same scope, constitution and plan.

## Deferred features

Login/refresh rotation, RBAC endpoints, S3 uploads, email/OAuth/payment/LiveKit
adapters, chat message persistence, domain schemas, outbox workers and ledger
operations are subsequent feature work. Selecting their design does not mean
they are implemented. Financial values and policies unresolved in SRS remain open.
