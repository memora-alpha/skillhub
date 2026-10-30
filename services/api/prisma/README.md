> OTP is Redis-owned as of 2026-10-08. Runtime has no OTP challenge/issue-window models; see [Redis OTP amendment](../specs/002-user-identity/redis-otp.md). The dev transition migration drops obsolete OTP tables/payload columns directly without preserving their records.

# SkillHub Prisma catalog — logical v3

The catalog follows [logical v3](../../../docs/SkillHub_Logical_Data_Model_v3.md)
and [field catalog v3](../../../docs/SkillHub_Entities_Fields_v3.md), with two
additive Achievement/UserAchievement models: **50 PostgreSQL models and one MongoDB Message document**. Conceptual v3 hides associative
entities; its simplification does not remove logical join tables.

## Catalog and implemented runtime

Advisory Verification AI adds the runtime-only `VerificationAiAnalysis` model via
`runtime-support.prisma` and the generator. Migration `20261023000000_verification_ai`
adds private snapshots/results, fenced leases and one active run per verification;
it does not modify approval state. See [rollout and contract](../specs/007-skills/verification-ai.md).

The 2026-10-19 Proposal amendment overlays catalog `candidateSlots` JSONB as
nullable TEXT in the runtime generator. Migration
`20261019000000_proposal_schedule_text` preserves populated arrays as JSON text,
maps empty arrays to null and avoids lifecycle UPDATE triggers. Apply it together
with the new API/client contract; the historical logical-v3 catalog stays intact.

- `catalog.prisma` is the v3 PostgreSQL catalog plus the SH-083 achievement extension. Its client output is
  `src/generated/prisma-catalog`, separate from the running identity client.
- `schema.prisma` is the runtime v3 schema, generated from the catalog by
  `scripts/generate-runtime-schema.mjs`. It includes the 50 domain models and
  eight technical models from `runtime-support.prisma` for foundation and Connections.
  Tag and RequestTag extend the runtime to meet SRS V1.6; they are not part of
  the 50-model catalog. Learning Request keeps its moderation/expiry
  metadata and application aliases mapped to v3 columns.
  `prisma.config.ts`, default generate/build/typecheck and migrations use it.
  Profile fields live on User; User has one required roleId.
- The [per-skill level catalog amendment](../specs/007-skills/skill-level-catalog.md)
  adds runtime `SkillLevel` and SharingSkill.levelId through the runtime generator
  and `runtime-support.prisma`; the historical logical-v3 catalog remains intact.
  Migration `20261014000000_skill_level_catalog` backfills all old selections.
- Tag/request amendment adds creator/version/normalized key to Tag and the
  `TagCreationRequest` runtime model. Migration
  `20261015000000_tag_creation_requests` retains existing IDs, labels, statuses
  and RequestTag links; legacy creator/creation time remain null. Run tag
  preflight before migration and `--verify` after it, then seed identity grants;
  [rollout instructions](../specs/009-tags/quickstart.md#rollout-database-hiện-hữu)
  describe collision/locale guards. The historical v3 catalog is unchanged.
- `scripts/write-identity-schema.mjs` verifies the runtime scope without rewriting it.
  OTP authority is Redis; no PostgreSQL OTP models are generated.
  There is no separate `identity.prisma` deployment schema.
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

Default `db:generate`, prebuild and predev generate the **full runtime v3** client.
`db:migrate`/`db:deploy` use the full runtime schema and migration history.
The runtime retains delivery encryption, scan leases, audit reasons up to 2000
characters and outbox retries. Equivalent application field names map to v3 SQL
columns. Legacy avatar checksums may be null; new uploads store SHA-256, and the
scanner verifies it. Existing reasons and unknown legacy checksums are not invented.
Multi-role accounts map to ADMIN, then STAFF, then USER; missing grants map to USER.
The Staff endpoint rejects replacing ADMIN with STAFF. Role arrays in existing
HTTP contracts now contain one role. Reputation uses 50 when not initialized.

## Representation and unresolved constraints

Credit foundation migration `20261015000000_credit_wallet_foundation` thêm per-wallet
ledger sequence, nonnegative/allocation checks và append-only ledger guards. Preflight
đòi lịch sử/Available/Held/allocations khớp; unexplained openings hoặc ambiguous order
dừng migration, không tự bù số dư. Zero-wallet backfill không cấp tiền. Trigger cấp sequence
trong wallet row lock và rollback cùng entry, dùng cho stable snapshot history pagination.
Migration này chưa thêm Payment posting hoặc source provenance lots; không deploy tự động.

Connections migration `20261009010000_connections` adds Proposal version/expiry/source
constraints and partial uniqueness, immutable Conversation membership, ChatPublication
receipts and the per-user replay feed. Non-null legacy credit suggestions or direct
proposals fail preflight because their units/target identity need operator review;
the migration never rescales or deletes them. Nullable historical expiry is backfilled
to createdAt + 7 days. Existing invalid text/party/duplicate rows must be resolved
before deployment. See [Connections quickstart](../specs/008-connections/quickstart.md).

Notification create/read and CHAT file state triggers append reference-only feed rows
and wakeup outbox in the same PostgreSQL transaction, including existing producer paths.
Sorted recipient counter locks allocate commit-ordered sequences. Wakeup outbox rows
also retain event dedupe after replay-prefix trimming; do not purge these receipts
without designing a replacement dedupe store. Business chat/receipt/file purge is disabled.

Mongo chat uses explicit native collection indexes and replica-set transactions.
Run `pnpm --filter api db:migrate:chat` against the intended isolated/deployment database
after reviewing `MONGODB_URI`; startup does not implicitly create these indexes.
Message drafts/content/read watermarks remain Mongo-owned. PostgreSQL stores only
command/draft digests, publication identity and references. Applying PostgreSQL
migrations alone does not enable message publication.

Skills migration `20261007010000_skills` adds normalized catalog keys, optimistic
versions, timestamps, active-sharing/pending-request partial unique constraints,
and durable StoredFile bindings. Runtime Prisma `APPROVED` maps to the historical
SQL enum value `VERIFIED` for verification requests; the model catalog stays unchanged.
The migration reports collision IDs before adding unique indexes. It requires
existing descriptions/reasons/sizes to satisfy the new checks; resolve invalid
legacy rows deliberately before deployment. New evidence batches require 1–5
bound files and at most 10,000,000 bytes per file. Unbound historical evidence is
retained, but cannot be newly approved or downloaded through Skills routes.
READY orphan evidence can enter cleanup after the existing 24-hour grace;
attached files and scan facts remain immutable and are retained for history.
Migration tests use disposable schemas and do not deploy the application database.

- Profile fields, reputation (default 50), and selected title are on User; one required roleId,
  no UserRole. OTP tables/issue windows, Withdrawal, SkillTag,
  separate confirmations/attendance/room, MaterialVersion and PathSettlement
  are absent from the v3 catalog. RolePermission/SharingSkill/UserLearnedSkill/
  MaterialEntitlement remain logical models.
- Learning Request preferred slots are JSONB, with no RequestPreferredSlot table.
  Its verified-teacher preference and versioned moderation/expiry metadata remain
  compatible with the existing feature contracts. Canonical Tag and the composite
  RequestTag relationship are retained for SRS V1.6 sections 18.10/9.2, FR-LR-01/
  07/08 and BR-07; see [alignment and Tag evidence](../specs/007-learning-request/erd-v3-alignment.md).
  Schema coverage does not establish Catalog eligibility, Sharing Skill matching,
  Path/Schedule/Wallet integration or migration rollout.
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
- SH-050..056 Path, Plan, Schedule, Session and Credit models already exist in the
  runtime schema and `20261007000000_runtime_v3`. Migration
  `20261020000000_sh050_056_path_scheduling_constraints` adds SQL-only checks for
  distinct participants, version/amount bounds, TWO_WAY/ONE_WAY terms, complete
  settlement snapshots, 60–180 minute schedule/session intervals, nonnegative
  wallet/attendance balances, and one current schedule-history row per session.
- Remaining cross-row/business rules need owner-level transaction checks: exactly
  one or two reciprocal plans, path/plan participant eligibility, contiguous
  outlines, schedule overlap and confirmation cutoff, content moderation binding,
  slot/evidence limits, entitlement source/buyer consistency, immutable snapshots/
  ledger/audit and dispute blocking. Prisma schema validation alone does not
  establish these behaviors.
- Partial uniqueness is required for active SharingSkill, PENDING verification/
  proposal and current SessionScheduleHistory. No blanket unique forbids history.
- Atomic workflows and locks are required for Hold, settlement, material purchase,
  payment callback, refunds and wallet/ledger reconciliation. No fee/min-max/no-show/
  penalty/refund value is invented for open policies.

Migration `20261009000000_achievement_badges` adds badge definitions/unlocks
and the public selected title. Runtime client generation and migration deployment
are still required before the extension can run against PostgreSQL.

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
