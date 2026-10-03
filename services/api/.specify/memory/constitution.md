# SkillHub Backend Constitution

Version: 1.2.0. Ratified: 2026-10-03. Last amended: 2026-10-03.

## Scope

Work on services/api. Keep Git and the pnpm workspace at the SkillHub root.
Codex and Claude use the same backend specs, plans and tasks. Do not modify
frontend/mobile unless explicitly requested. Read ../../docs/ for product requirements.

## Principles

1. Use a NestJS modular monolith with Memora-style module boundaries. Keep HTTP
   transport, application use cases, domain policies and infrastructure adapters
   separate where they have distinct responsibilities. Do not add empty layers.
2. PostgreSQL/Prisma owns users, permissions, conversations/participants, scheduling,
   sessions, wallets, ledger, payments, dispute and critical audit. MongoDB/Mongoose
   owns chat message documents. Redis/BullMQ supports cache and jobs.
3. Keep critical relational workflows atomic in PostgreSQL. Never split balances
   and ledger across stores. Use integer Credit/VND and idempotency keys; retain
   successful ledger history. Cross-store events require retry and duplicate protection.
4. Authentication uses access JWT, refresh rotation/revocation and Argon2id password
   hashing. Authorization checks explicit roles/permissions and resource membership.
   Secrets and private evidence must not appear in public APIs or logs.
5. Validate environment on startup and requests at the API boundary. Publish API
   contracts with Swagger/OpenAPI. Store timestamps in UTC and define pagination
   and BIGINT JSON serialization explicitly. Use S3-compatible storage for file bytes.
6. Verify changes with appropriate lint, typecheck, build and behavioral tests.
   Test financial concurrency, rollback, idempotency and permissions against real
   storage when those features are implemented. Distinguish static and runtime evidence.
7. Each business module owns its data and the rules for changing it. Other modules
   use its exported application contracts or ports; they do not bypass those rules
   by writing directly to its tables or collections. Keep repositories inside the
   owning module's infrastructure. Cross-module PostgreSQL workflows may share an
   explicit transaction context through these contracts to preserve atomicity.
   Each entity has one authoritative store; copies and projections must be identified
   as derived data with a documented synchronization and recovery strategy.
8. Treat jobs, webhooks and cross-store delivery as potentially duplicated and
   out of order. Verify webhook authenticity before changing business state, validate
   transitions and make consumers idempotent. Use bounded retries with backoff and
   retain failed delivery records for diagnosis and safe replay. Publish committed
   state changes after commit; when delivery must survive a crash, persist an outbox
   event in the same PostgreSQL transaction. Do not hold critical database transactions
   open while calling external providers. Define recovery behavior and test duplicate,
   stale and failed deliveries when these integrations are implemented.

## Governance

The accepted foundation decisions are in specs/001-backend-foundation/plan.md.
Selecting a technology does not imply its business feature is implemented.
Unresolved product policy values remain questions in the related spec.

Every feature plan must include a Constitution Check covering the applicable
principles, affected modules, authoritative stores, transaction boundaries and
verification evidence. Record each check as Pass, Not applicable with a reason,
Pending, or Approved exception with a reference. Recheck after design and before
declaring implementation complete. Planned compliance is not runtime evidence;
pending checks must remain visible in the feature's tasks and validation report.

Document exceptions in the plan's Complexity Tracking section: the violated
principle, reason, alternatives rejected, impact, mitigation, responsible owner,
and expiry or removal condition. A departure from an accepted principle requires
explicit user approval recorded with the exception; routine choices within these
principles do not require additional approval. Codex and Claude must not silently
introduce conflicting decisions or turn unresolved product policy into defaults.

When the user changes an accepted decision, amend this constitution and the affected
specs, plans, tasks, README and templates. Use a major version for incompatible
principle changes, a minor version for added principles or governance requirements,
and a patch version for clarifications. Record the amendment date and a short change
entry. Keep feature-specific parameters and implementation details in feature plans.

## Git workflow

Use `<type>/<short-kebab-name>` branches with lowercase kebab-case descriptions.
Choose the type by intent: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`,
`style`, `test`, `perf`, `build`, `ci`, `revert`, `experimental`, `release`, or
`merge`. Do not add numeric spec prefixes to branches. For example,
`feat/user-auth` corresponds to `specs/002-user-auth`; the spec directory keeps
its number independently. Reuse an existing branch when a change belongs to its
scope. Branch naming does not authorize creating commits or pushing changes.

Write Conventional Commits: `<type>(<scope>): <short description>`, with a
lowercase type and a concise English description of the resulting change.
Commit types are `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`,
`perf`, `build`, `ci`, or `revert`; urgent fixes still use commit type `fix`.
Use `!` and a `BREAKING CHANGE:` footer for incompatible public contract changes.

Commit scope follows the staged files, as in Memora:

- Files entirely under one workspace use its package name without the npm namespace,
  for example `docs(api): document backend ownership`.
- Files entirely under one `src/modules/<module>` directory use `package/module`,
  for example `feat(api/auth): add refresh rotation`.
- Multiple modules, or module code plus API specs/docs, use `api`.
- Root or multiple-workspace changes may omit scope, for example
  `chore: configure commit validation`. If a scope is used, it must identify an
  existing workspace, optionally followed by an existing module.

Keep each commit focused on one coherent change and stage explicit paths after
reviewing status and diff. Run the relevant checks before committing; root hooks
format staged files, lint staged API TypeScript and validate the commit message
against staged paths. Hooks do not replace typecheck, build or behavioral tests.
Do not bypass hooks to hide failures. Record unavailable runtime verification in
the feature validation report rather than claiming it passed.

## Amendment history

- 1.2.0 (2026-10-03): Adopted Memora-style branch naming, Conventional Commits,
  staged workspace/module scopes and shared Git hooks.

- 1.1.0 (2026-10-03): Added module/data ownership, reliable jobs and webhooks,
  Constitution Check evidence, exception handling and amendment rules.
- 1.0.0 (2026-10-03): Ratified backend scope and the six foundation principles.
