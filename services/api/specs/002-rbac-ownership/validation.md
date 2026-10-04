# RBAC SH-002 validation

Date: 2026-10-04. Status: partial implementation; SH-002 Definition of Done is
not yet met across real business APIs.

## Implemented and verified

- An explicit permission catalog and types for USER/STAFF/ADMIN, account status,
  action restrictions and the identity/actor contract. Guest is represented by
  absence of an authenticated identity; no GUEST role is introduced.
- `AccessControlService` reads an actor through the users-owned reader contract
  on each request. It rejects missing/mismatched identities, inactive accounts,
  blocked actions and missing permissions. The PostgreSQL reader is pending.
- `PermissionGuard` combines controller/method action requirements, rejects
  missing or conflicting access metadata, and sets actor context only after a
  trusted identity is supplied by the auth guard.
- `ResourceAccessGuard` delegates owner/participant decisions to a resolver
  supplied by the module owning the resource; it validates UUID/ULID path IDs
  and returns the same 404 for missing/out-of-scope private objects. Conflicting
  class/method resource policies fail closed.
- A test-only Nest HTTP module verifies the guard chain and existing error
  envelope. Its fixture bearer values are not production authentication.

Verification from the API workspace:

| Check                                              | Result                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `eslint . --max-warnings 0`                        | Pass                                                                   |
| `tsc -p tsconfig.json --noEmit`                    | Pass                                                                   |
| `nest build`                                       | Pass                                                                   |
| `node --test test/foundation.test.mjs`             | Pass, 5 tests                                                          |
| `npm run test:rbac` (build + unit/HTTP tests)      | Pass, 13 tests; HTTP test required local socket access outside sandbox |
| Prettier check of touched API source/tests/package | Pass                                                                   |

`prisma generate` succeeded with a local placeholder DATABASE_URL; no database
connection or migration was tested. The Prisma schema still has only the
foundation SystemConfiguration model. Full `pnpm install` ended with pnpm 11's
ignored-build-script warning, but the installed tools generated Prisma Client
and completed all checks above. The unexpected baseline TypeScript error in
`HttpExceptionFilter` was traced to resolution of a transitive Express type
under this Windows pnpm layout; the filter now declares only the status/json
response surface it actually calls. Its runtime behavior did not change and
foundation tests pass.

## Pending for SH-002

- RBAC-05 with Huy: authoritative User model, UserRole/RolePermission schema,
  migration, PostgreSQL authorization reader and current account restriction
  state. No dummy User table or production grant seed was introduced.
- SH-012 with Huy: verified JWT/session identity, revocation and production
  guard order/wiring in AppModule. The current guards are reusable code, not yet
  active on production API routes.
- RBAC-01 / OP-06: approved Staff action grants; RBAC-04 / OP-04: case-scoped
  chat/evidence access. No undecided Staff/chat grant was seeded.
- Real owner/participant resolvers, list/count/export scope, nested resource
  checks and mutation rechecks in module transactions. Chat/Session/LiveKit
  modules are not present in this checkout.
- SH-003 reason/audit integration and regression for sensitive mutations.
  `test:rbac:integration` and real JWT/DB tests remain pending until these
  dependencies exist.

Constitution v1.2.0 review: modular boundaries, PostgreSQL authority and
explicit permissions are respected by design. Runtime authorization, atomic
mutation/audit and real-store tests remain Pending. No exception is requested.
