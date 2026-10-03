# Backend foundation tasks

- [x] Record accepted technical decisions and backend constitution.
- [x] Configure PostgreSQL/Prisma, MongoDB/Mongoose, Redis/BullMQ dependencies and lifecycle.
- [x] Add initial SystemConfiguration metadata migration and Prisma generation scripts.
- [x] Add central env validation, DTO validation, error handling, Pino, Helmet and Swagger.
- [x] Add liveness/readiness and API-scoped Docker Compose with persistent volumes.
- [x] Validate schema, lint, types, build and config/error handling tests.
- [x] Apply foundation migration and verify PostgreSQL/MongoDB/Redis connections plus HTTP health/readiness and Swagger with configured development services.
- [ ] Verify BullMQ job behavior and graceful shutdown with the running services.

Runtime configuration is supplied through the ignored API .env. Developers may
use installed services, team-provided servers or Docker Compose. Each checkout
should repeat migration and readiness checks using its own configuration.

Business feature tasks are created in their own specifications. No authentication,
chat persistence, S3 adapter or financial endpoint is claimed complete here.
