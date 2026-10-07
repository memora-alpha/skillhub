# SkillHub Prisma catalog — logical v3

The catalog follows [logical v3](../../../docs/SkillHub_Logical_Data_Model_v3.md)
and [field catalog v3](../../../docs/SkillHub_Entities_Fields_v3.md): **48 PostgreSQL
models and one MongoDB Message document**. Conceptual v3 hides associative
entities; its simplification does not remove logical join tables.

## Catalog and implemented runtime

- `catalog.prisma` is the v3 PostgreSQL catalog. Its client output is
  `src/generated/prisma-catalog`, separate from the running identity client.
- `schema.prisma` is the runtime v3 schema, generated from the catalog by
  `scripts/generate-runtime-schema.mjs`. It includes the 48 domain models and
  seven technical models from `runtime-support.prisma` for OTP and foundation.
  `prisma.config.ts`, default generate/build/typecheck and migrations use it.
  Profile fields live on User; User has one required roleId.
- `scripts/write-identity-schema.mjs` verifies the runtime scope without rewriting it.
  Existing OTP remains PostgreSQL-backed; its omission from the diagram did not
  authorize removing authentication functionality.
- `chat.schema.prisma` is reference-only. MessageAttachment is an embedded `type`,
  not a collection/model. Runtime ownership remains MongoDB/Mongoose; Prisma 7
  cannot validate/generate this file as a runtime MongoDB schema.

Migration `20261007000000_runtime_v3` backfills profiles and a single role, renames
existing columns and adds v3 tables. It preserves original profile/grant rows in
`<current_schema>_legacy_v3`. It does not deploy itself. Client/schema validation does not demonstrate
financial concurrency, database deployment or working business features.

## Commands from repository root

```powershell
python services/api/scripts/generate-prisma-catalog.py
node services/api/scripts/generate-runtime-schema.mjs
pnpm --filter api exec prisma format --schema prisma/schema.prisma
pnpm --filter api exec prisma format --schema prisma/catalog.prisma
pnpm --filter api db:validate:catalog
pnpm --filter api db:generate:catalog
pnpm --filter api db:validate:runtime
pnpm --filter api check-types
```

Default `db:generate`, prebuild and predev generate the **identity runtime** client.
`db:migrate`/`db:deploy` use the full runtime schema and migration history.
The runtime retains delivery encryption, scan leases, audit reasons up to 2000
characters and outbox retries. Equivalent application field names map to v3 SQL
columns. Legacy avatar checksums may be null; new uploads store SHA-256, and the
scanner verifies it. Existing reasons and unknown legacy checksums are not invented.
Multi-role accounts map to ADMIN, then STAFF, then USER; missing grants map to USER.
The Staff endpoint rejects replacing ADMIN with STAFF. Role arrays in existing
HTTP contracts now contain one role. Reputation uses 50 when not initialized.

## Representation and unresolved constraints

- Profile fields and reputation (default 50) are on User; one required roleId,
  no UserRole. OTP tables/issue windows, Withdrawal, Achievement, SkillTag,
  separate confirmations/attendance/room, MaterialVersion and PathSettlement
  are absent from the v3 catalog. RolePermission/SharingSkill/UserLearnedSkill/
  MaterialEntitlement remain logical models.
- Path/Plan/version/outline membership uses explicit composite keys and FKs.
  User avatar ownership and reauth session ownership are composite references.
  Current/locked/applied version pointers must be checked at transitions; cyclic
  initial draft creation requires an intentional SQL/deferred-constraint design.
- LearningPath stores one nullable settlement group, linked to its owned version,
  fee policy and unique CreditOperation. Rows must be locked/conditionally updated
  to prevent two different operations settling one path. A unique operation ID
  alone does not provide that invariant.
- Session keeps role-specific confirmations, room and attendance summaries;
  reconnect/duplicate/out-of-order webhook aggregation still needs feature design.
- Material stores current file metadata; Order stores immutable purchased-file
  JSON. Entitlement controls access; retained object and current scan policy must
  be enforced. FREE access need not create an Order.
- Credit BigInt values are **hundredths of a Credit** (100 units = 1 Credit),
  VND and sizes are unscaled. Fee rates use Decimal(12,8); final rounding follows
  approved policy. Client contracts must expose units and serialization explicitly.
- IDs use `id` as a Prisma property mapped to the logical primary-key column.
  Composite key fields retain camelCase logical names. These column mappings differ
  from legacy identity `id` columns and need a deliberate migration.
- Known SRS vocabularies are enums; open status/reason/config/provider vocabularies
  use String and require owner validation before release. Identity email kind is
  open in v3; no PostgreSQL OTP challenge is introduced through delivery metadata.
- SQL CHECKs/partial indexes/cross-row rules are not expressible by plain Prisma
  validation: positive amounts/nonnegative balances, reputation/rating ranges,
  TWO_WAY/ONE_WAY field exclusivity, settlement group all-null/all-present,
  content moderation binding, 1/2 reciprocal plans and 60–180 minute sessions,
  slot/evidence limits, distinct/eligible participants, entitlement source/buyer
  consistency, immutable snapshots/ledger/audit and dispute blocking remain required.
- Partial uniqueness is required for active SharingSkill, PENDING verification/
  proposal and current SessionScheduleHistory. No blanket unique forbids history.
- Atomic workflows and locks are required for Hold, settlement, material purchase,
  payment callback, refunds and wallet/ledger reconciliation. No fee/min-max/no-show/
  penalty/refund value is invented for open policies.

## Coverage

| Logical table               | Prisma model                     | Store             |
| --------------------------- | -------------------------------- | ----------------- |
| `users`                     | `User`                           | PostgreSQL        |
| `roles`                     | `Role`                           | PostgreSQL        |
| `permissions`               | `Permission`                     | PostgreSQL        |
| `role_permissions`          | `RolePermission`                 | PostgreSQL        |
| `oauth_accounts`            | `OAuthAccount`                   | PostgreSQL        |
| `refresh_sessions`          | `RefreshSession`                 | PostgreSQL        |
| `skill_categories`          | `SkillCategory`                  | PostgreSQL        |
| `skills`                    | `Skill`                          | PostgreSQL        |
| `sharing_skills`            | `SharingSkill`                   | PostgreSQL        |
| `skill_verifications`       | `SkillVerification`              | PostgreSQL        |
| `skill_evidence`            | `SkillEvidence`                  | PostgreSQL        |
| `user_learned_skills`       | `UserLearnedSkill`               | PostgreSQL        |
| `learning_requests`         | `LearningRequest`                | PostgreSQL        |
| `proposals`                 | `Proposal`                       | PostgreSQL        |
| `conversations`             | `Conversation`                   | PostgreSQL        |
| `schedule_proposals`        | `ScheduleProposal`               | PostgreSQL        |
| `schedule_versions`         | `ScheduleVersion`                | PostgreSQL        |
| `schedule_items`            | `ScheduleItem`                   | PostgreSQL        |
| `sessions`                  | `Session`                        | PostgreSQL        |
| `credit_wallets`            | `CreditWallet`                   | PostgreSQL        |
| `held_credit_allocations`   | `HeldCreditAllocation`           | PostgreSQL        |
| `credit_transactions`       | `CreditTransaction`              | PostgreSQL        |
| `payments`                  | `Payment`                        | PostgreSQL        |
| `system_configurations`     | `SystemConfiguration`            | PostgreSQL        |
| `reviews`                   | `Review`                         | PostgreSQL        |
| `reputation_history`        | `ReputationHistory`              | PostgreSQL        |
| `report_cases`              | `ReportCase`                     | PostgreSQL        |
| `report_evidence`           | `ReportEvidence`                 | PostgreSQL        |
| `notifications`             | `Notification`                   | PostgreSQL        |
| `audit_logs`                | `AuditLog`                       | PostgreSQL        |
| `refresh_credentials`       | `RefreshCredential`              | PostgreSQL        |
| `reauth_proofs`             | `ReauthProof`                    | PostgreSQL        |
| `avatar_assets`             | `AvatarAsset`                    | PostgreSQL        |
| `identity_email_deliveries` | `IdentityEmailDelivery`          | PostgreSQL        |
| `learning_paths`            | `LearningPath`                   | PostgreSQL        |
| `learning_path_versions`    | `LearningPathVersion`            | PostgreSQL        |
| `learning_plans`            | `LearningPlan`                   | PostgreSQL        |
| `learning_plan_versions`    | `LearningPlanVersion`            | PostgreSQL        |
| `plan_session_outlines`     | `PlanSessionOutline`             | PostgreSQL        |
| `path_version_plans`        | `PathVersionPlan`                | PostgreSQL        |
| `session_schedule_history`  | `SessionScheduleHistory`         | PostgreSQL        |
| `fee_policy_versions`       | `FeePolicyVersion`               | PostgreSQL        |
| `credit_operations`         | `CreditOperation`                | PostgreSQL        |
| `materials`                 | `Material`                       | PostgreSQL        |
| `material_orders`           | `MaterialOrder`                  | PostgreSQL        |
| `material_entitlements`     | `MaterialEntitlement`            | PostgreSQL        |
| `user_restrictions`         | `UserRestriction`                | PostgreSQL        |
| `outbox_events`             | `OutboxEvent`                    | PostgreSQL        |
| `messages`                  | `Message` (embedded attachments) | MongoDB reference |
