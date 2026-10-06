# Prisma catalog v3 review

Date: 2026-10-06. Scope: schema/catalog generation, not database deployment.

## Findings and changes

The old catalog had 45 PostgreSQL models and two MongoDB models. It represented
separate Profile/UserRole/OTP/slot/confirmation/room/attendance/Withdrawal models,
had no LearningPath/LearningPlan/material purchase models and described settlement
per Session. These structures do not match the user's logical v3 decisions.

`schema.prisma` now contains 48 PostgreSQL models generated from logical v3.
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

The implemented repositories require Profile, UserRole, OtpChallenge/OtpIssueWindow
and the legacy identity-specific delivery/upload/session fields. Simply regenerating
their existing client from the new catalog would break the API and migrations.

`prisma.config.ts` therefore uses the retained `identity.prisma` by default, with
its existing client output. The v3 catalog uses a separate client output, and
explicit `db:validate` / `db:generate:catalog` commands. The compatibility identity
script no longer extracts the legacy runtime schema from the new catalog.

This separation is a transition boundary, not a v3 runtime implementation. Before
switching the API, implement and review:

1. Single-role mapping for multi-role/no-role accounts, profile backfill, column
   mapping and preservation of existing reputation/history.
2. Redis-only OTP runtime changes and durable-email delivery adjustments; removing
   SQL models from the catalog does not move existing OTP state to Redis.
3. Repository/contract/seed adaptations and migration of hundredth-Credit units.
4. Feature-scoped migrations with CHECKs, partial indexes, ownership/membership
   rules and guarded atomic financial transitions documented in logical v3.

Existing migration SQL and seed/operator files are unchanged. No migration, db push,
database reset, deployment, commit or push was executed for this catalog update.

## Constitution check

| Principle                             | Result                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Backend scope, module/store ownership | Pass: API schema/docs only; PostgreSQL critical state and Mongo/Mongoose chat retained.                                    |
| Integer Credit / atomic workflows     | Pass at catalog level: BigInt units explicit; application/SQL concurrency gates remain feature work.                       |
| Auth/ownership/private data           | Pass at schema design level: ownership FKs represented; existing identity runtime preserved. Runtime v3 migration pending. |
| Verification and actual deployment    | Schema/client/type checks recorded after execution; no deployed-v3 claim.                                                  |
| Reliable events / idempotency         | Operation/outbox keys and metadata represented; provider/consumer behavior remains feature work.                           |

## Validation

Completed with Prisma 7.8.0:

- Logical coverage: 48/48 PostgreSQL tables, 483/483 scalar fields; one MongoDB
  Message model with embedded MessageAttachment type. Removed models absent.
- Prisma format and `db:validate`: passed; 48 models and 32 enums.
- `db:generate:catalog`: passed, output to the isolated catalog client.
- `db:validate:runtime` and `check-types`: passed for the existing API consumers.
- API lint: passed. Foundation tests: 5 passed, 0 failed.
- Legacy identity schema body and migration SQL preserved; compatibility script
  verified without rewriting identity.prisma.

The separate MongoDB reference is not treated as a runnable Prisma 7 schema.
DB concurrency, permissions and retention behavior require real-storage tests when
their owning features are implemented; plain Prisma validation cannot establish
those guarantees. No DB-backed migration/integration test was run for catalog v3.
