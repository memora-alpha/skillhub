# SkillHub Prisma schema catalog

The full requirements-derived catalog in `docs/SkillHub_Entities_Fields.md` and
`docs/SkillHub_Logical_Data_Model.md` is represented by the files here:

- [schema.prisma](schema.prisma): 52 PostgreSQL models, 27 enums; this is the API's actual Prisma schema.
- [chat.schema.prisma](chat.schema.prisma): two MongoDB document models expressed as Prisma reference only. Runtime continues to use Mongoose; this file has no generator and is excluded from the API Prisma config. PostgreSQL Conversation/User references in documents are application-validated, not cross-database foreign keys.

The full catalog does not imply all modules are implemented. Spec 002 implements
identity only, with a reviewed migration tested in disposable PostgreSQL schemas.
[identity.prisma](identity.prisma) is generated from the catalog by
`scripts/write-identity-schema.mjs`; `db:migrate` uses that current deployment scope.
It contains SystemConfiguration, identity/foundation models, and the scoped
Skill/SkillCategory/Tag and Learning Request dependencies selected by feature
migrations. The snapshot generator removes relations to models outside deployment
scope. No migration has been deployed into the existing
application schema; no `db push` was performed. Seed/bootstrap and runtime checks
are documented in [identity quickstart](../specs/002-user-identity/quickstart.md).

## Catalog coverage

The legacy logical concepts are mapped below; Learning Request now follows the user-supplied v3 ERD. Its preferred slots are a JSONB field instead of a separate table. See [alignment and Tag evidence](../specs/007-learning-request/erd-v3-alignment.md). Other v3 modules are not audited by this feature. Catalog source fields are kept,
with the identity feature's more specific credential/session/upload structures.

| Logical table              | Prisma model            | Store             |
| -------------------------- | ----------------------- | ----------------- |
| `users`                    | `User`                  | PostgreSQL        |
| `profiles`                 | `Profile`               | PostgreSQL        |
| `roles`                    | `Role`                  | PostgreSQL        |
| `user_roles`               | `UserRole`              | PostgreSQL        |
| `permissions`              | `Permission`            | PostgreSQL        |
| `role_permissions`         | `RolePermission`        | PostgreSQL        |
| `otp_challenges`           | `OtpChallenge`          | PostgreSQL        |
| `oauth_accounts`           | `OAuthAccount`          | PostgreSQL        |
| `refresh_sessions`         | `RefreshSession`        | PostgreSQL        |
| `skill_categories`         | `SkillCategory`         | PostgreSQL        |
| `skills`                   | `Skill`                 | PostgreSQL        |
| `sharing_skills`           | `SharingSkill`          | PostgreSQL        |
| `skill_verifications`      | `SkillVerification`     | PostgreSQL        |
| `skill_evidence`           | `SkillEvidence`         | PostgreSQL        |
| `user_learned_skills`      | `UserLearnedSkill`      | PostgreSQL        |
| `learning_requests`        | `LearningRequest`       | PostgreSQL        |
| `proposals`                | `Proposal`              | PostgreSQL        |
| `proposal_candidate_slots` | `ProposalCandidateSlot` | PostgreSQL        |
| `conversations`            | `Conversation`          | PostgreSQL        |
| `messages`                 | `Message`               | MongoDB reference |
| `message_attachments`      | `MessageAttachment`     | MongoDB reference |
| `schedule_proposals`       | `ScheduleProposal`      | PostgreSQL        |
| `schedule_versions`        | `ScheduleVersion`       | PostgreSQL        |
| `schedule_items`           | `ScheduleItem`          | PostgreSQL        |
| `schedule_confirmations`   | `ScheduleConfirmation`  | PostgreSQL        |
| `sessions`                 | `Session`               | PostgreSQL        |
| `session_confirmations`    | `SessionConfirmation`   | PostgreSQL        |
| `livekit_rooms`            | `LiveKitRoom`           | PostgreSQL        |
| `session_attendance`       | `SessionAttendance`     | PostgreSQL        |
| `credit_wallets`           | `CreditWallet`          | PostgreSQL        |
| `held_credit_allocations`  | `HeldCreditAllocation`  | PostgreSQL        |
| `credit_transactions`      | `CreditTransaction`     | PostgreSQL        |
| `payments`                 | `Payment`               | PostgreSQL        |
| `withdrawals`              | `Withdrawal`            | PostgreSQL        |
| `system_configurations`    | `SystemConfiguration`   | PostgreSQL        |
| `reviews`                  | `Review`                | PostgreSQL        |
| `reputation_history`       | `ReputationHistory`     | PostgreSQL        |
| `report_cases`             | `ReportCase`            | PostgreSQL        |
| `report_evidence`          | `ReportEvidence`        | PostgreSQL        |
| `notifications`            | `Notification`          | PostgreSQL        |
| `audit_logs`               | `AuditLog`              | PostgreSQL        |

Additional PostgreSQL helpers: `avatar_assets`, `identity_email_deliveries`, `otp_issue_windows`, `reauth_proofs`, `refresh_credentials`.

## Representation decisions

- UUID identifiers, UTC timestamptz, snake_case tables/columns, named inverse relations, composite PK/FKs, unique keys and query indexes are explicit. Restrict deletes preserve referenced history; cleanup needs intentional use cases.
- Identity models retain the existing `id` column convention. Catalog models use application `id` mapped to their logical PK names, except composite keys and CreditWallet's `userId` PK. Role logical `name` is `code`; normalized login email replaces logical `email`.
- Profile avatar storage key is owned through AvatarAsset; reputation remains nullable without an approved initial score. Terms/timezone/lifetimes are not invented defaults.
- OTP hash/attempts live in OtpChallenge, resend windows in OtpIssueWindow, and refresh token digests/history in RefreshCredential linked to RefreshSession. CHANGE_EMAIL/OAuthAccount are now represented for catalog completeness but identity endpoints still defer these flows.
- User.passwordHash is nullable to represent Google-only accounts. Email/password registration must require a valid Argon2id hash; login must handle absent hash generically. Safe OAuth linking and terms acceptance remain future use-case checks.
- SkillVerification outcomes use PENDING/VERIFIED/REJECTED; VERIFIED is the SRS-approved outcome. Optional SkillCategory, attendance, OAuth and Withdrawal schema presence does not enable their features.
- Schedule versions/items/confirmations retain composite version keys. Participant confirmations/total held values are derived from the selected version rather than duplicate booleans on ScheduleProposal. Session links to ScheduleProposal via ScheduleItem/Version and to LiveKitRoom by inverse one-to-one.
- Credit/VND, ledger deltas/balances and relational file sizes use BigInt. Serialize BigInt as decimal strings in future API contracts; file-size business limits still apply. Mongo chat file sizes use Int for the 10 MB limit.
- CreditTransaction requires unique idempotencyKey and stores available/held deltas and after-balances rather than one ambiguous balanceAfter. SESSION_EARNING is represented for exceptional dispute decisions only; ordinary settlement returns 96% to each participant's own wallet. No invented earnedCredit bucket, rounding, penalty or withdrawal policy.
- Audit/credit/report source references that can target non-UUID objects use String/Text. Account SYSTEM audit actor is actorId/actorRole null; never a stored Guest role.
- Open SRS vocabularies use String rather than invented enums: confirmation/allocation status, provider, report reason/resolution, reputation source, notification type and configuration valueType. Owning features must close/validate these sets before release.
- Bank account stores ciphertext; application encryption must include key identification/envelope metadata and keep keys outside database. Secrets are never protected merely by a Prisma type.

## Constraints requiring migration or application logic

No schema validation alone proves business safety. Required follow-up includes:

- SQL CHECKs for normalized emails/names, positive amounts and nonnegative balances/counters, reputation/rating ranges, durations/time ordering, file MIME/size and state-dependent reason/resolution fields.
- SQL partial uniqueness for one active SharingSkill per user/skill, one PENDING SkillVerification, one PENDING Proposal per request/proposer and one outstanding OTP per user/purpose. No blanket unique constraint should prohibit valid historical rows. Partial-index preview is intentionally not enabled in the stable generator.
- Cross-row checks for two distinct/eligible participants, accepted Proposal/Conversation consistency, current-version existence/confirmation membership, aggregate slot/evidence limits, learned-skill completion and schedule/session/Held consistency.
- Transactions/locks for two-sided Hold/Session creation, wallet-ledger reconciliation, 96%/4% settlement, payment authenticity/idempotency, withdrawal reserve/release and dispute blocking. Successful ledger/audit append-only protection requires use cases plus DB privileges/triggers.
- Current permission/ownership checks, one-use proof transitions, encrypted durable delivery/expiry, scanned private files, projection synchronization and safe replay/retention.

## Validation

`pnpm --filter api db:validate` and `pnpm --filter api check-types` passed with
Prisma 7.8.0; the latter generated the ignored PostgreSQL client and typechecked
existing API consumers. The earlier 42-table comparison predates the LR v3 JSON-slot representation; current LR mapping and verification are recorded in the feature alignment report.
Prisma formatting passed. Spec 002 additionally tests its migration, constraints,
concurrency and identity behavior against real PostgreSQL/Redis; see
[validation](../specs/002-user-identity/validation.md). Future catalog behavior remains unimplemented.

The Mongo reference is not a Prisma 7 runtime schema and was not validated/generated
as an executable client. The project keeps MongoDB/Mongoose ownership; Prisma's
[MongoDB upgrade guide](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/mongodb)
states that Prisma 7 has no MongoDB connector. Changing the runtime ODM needs a
separate architecture decision.
