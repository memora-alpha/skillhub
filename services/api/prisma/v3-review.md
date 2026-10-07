# Prisma catalog v3 review

Date: 2026-10-06. Scope: schema/catalog generation, not database deployment.

## Findings and changes

The old catalog had 45 PostgreSQL models and two MongoDB models. It represented
separate Profile/UserRole/OTP/slot/confirmation/room/attendance/Withdrawal models,
had no LearningPath/LearningPlan/material purchase models and described settlement
per Session. These structures do not match the user's logical v3 decisions.

`catalog.prisma` now contains 48 PostgreSQL models generated from logical v3.
Every PostgreSQL table, logical scalar field and FK marker is covered. Logical
associations remain, even though conceptual v3 does not draw them as entities.
The MongoDB reference has one Message model and an embedded attachment value type.

Important representation changes:

- User owns profile/reputation fields and a single required Role FK.
- Path/Plan/version/outline mappings preserve separate directional teaching plans.
- Version/session confirmations, Session room/attendance, slot arrays and Message
  attachments are merged as agreed. Attendance keeps aggregates, not event history.
- LearningPath owns final settlement data and references a unique CreditOperation.
- Hold is scoped to Path/User; reviews and learned-skill grants refer to Path/Plan.
- Material owns current file metadata; Order preserves purchased-file JSON;
  Entitlement controls access. FeePolicyVersion remains separate.
- Successful ledger operations are grouped and idempotent. Credit is BigInt in
  hundredths; VND is unscaled. Schema generation does not migrate old whole-Credit
  balances or change their meaning in the running API.
- Open vocabularies remain String, marked for use-case validation; no fee/rounding/
  cancellation/refund policy is inferred from a Prisma enum/default.

## Runtime compatibility and migration boundary

Updated 2026-10-07 at the user's request: `prisma.config.ts` uses the full v3
runtime in `schema.prisma`, generated from `catalog.prisma` plus seven technical
OTP/foundation models. Repositories use inline User profiles and one roleId.
Legacy application property names for equivalent session/avatar/audit/outbox
fields map to the v3 SQL columns. OTP remains transactional in PostgreSQL, as
the logical model only excluded it from the diagram.

Migration `20261007000000_runtime_v3` renames columns, backfills profiles and
maps existing role grants with ADMIN > STAFF > USER priority. It archives the
original Profile/UserRole tables in `<current_schema>_legacy_v3`, preserves audit
immutability and existing reputation, and uses 50 only for uninitialized scores.
New avatars include SHA-256; legacy checksums remain null until bytes are rechecked.
Audit reasons retain the implemented 2000-character foundation bound.

Remaining feature work:

1. Migration of existing whole-Credit balances when the Credit feature is implemented.
2. Any future Redis-only OTP redesign requires its own consistency/recovery plan.
3. Domain APIs beyond the implemented identity/foundation services.
4. Feature-scoped migrations with CHECKs, partial indexes, ownership/membership
   rules and guarded atomic financial transitions documented in logical v3.

The original migration SQL and seed/operator files are retained. The v3 upgrade
has been tested in disposable schemas; the application database is not deployed
or reset by this change.

## Constitution check

| Principle                             | Result                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Backend scope, module/store ownership | Pass: API schema/docs only; PostgreSQL critical state and Mongo/Mongoose chat retained.              |
| Integer Credit / atomic workflows     | Pass at catalog level: BigInt units explicit; application/SQL concurrency gates remain feature work. |
| Auth/ownership/private data           | V3 identity repositories and ownership FKs implemented; application deployment remains pending.      |
| Verification and actual deployment    | Schema/client/type checks recorded after execution; no deployed-v3 claim.                            |
| Reliable events / idempotency         | Operation/outbox keys and metadata represented; provider/consumer behavior remains feature work.     |

## Validation

Original catalog validation (2026-10-06), with Prisma 7.8.0:

- Logical coverage: 48/48 PostgreSQL tables, 483/483 scalar fields; one MongoDB
  Message model with embedded MessageAttachment type. Removed models absent.
- Prisma format and `db:validate:catalog`: passed; 48 models and 32 enums.
- `db:generate:catalog`: passed, output to the isolated catalog client.
- `db:validate:runtime` and `check-types`: passed for the existing API consumers.
- API lint: passed. Foundation tests: 5 passed, 0 failed.
- Legacy identity schema body and migration SQL preserved; compatibility script
  verified without rewriting schema.prisma.

The separate MongoDB reference is not treated as a runnable Prisma 7 schema.
DB concurrency, permissions and retention behavior require real-storage tests when
their owning features are implemented; plain Prisma validation cannot establish
those guarantees.

Runtime update validation (2026-10-07): API lint, typecheck and build passed.
The backfill migration passed against a disposable PostgreSQL schema with seeded
legacy user/profile/multiple-role/audit/outbox rows. The regression suites passed
91 tests, including v3 role/profile projections and migration preservation.
All 17 identity PostgreSQL/Redis/BullMQ journey tests passed with the v3 runtime.
