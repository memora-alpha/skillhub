# SkillHub Logical Data Model

This document accompanies `SkillHub_Logical_Data_Model.drawio`. The diagram is a single editable canvas with table names, columns, logical data types, PK/FK/UQ/NN markers, and crow's-foot relationships. It develops the conceptual model from `SRS_SkillHub_V1.3.docx` and `rule&flow.png`; no application schema was available for implementation verification.

## Notation

| Marker | Meaning |
|---|---|
| `PK` | Primary key, including each part of a composite key |
| `FK` | Foreign key; composite foreign keys are described below |
| `UQ` | Unique column constraint; additional composite unique constraints are described below |
| `NN` | Required / not null |
| `UUID`, `VARCHAR(n)`, `TEXT`, `JSON`, `TIMESTAMP`, `ENUM` | Database-neutral logical types; timestamps use UTC |
| `BIGINT` for Credit and VND | Integer units only; no floating point balances |

## Domain decisions made in the logical model

1. **One account model:** `users` serves both learners and sharers. `profiles` has a one-to-one key to `users`. Guest is not stored as a role.
2. **Authorization:** `user_roles` and `role_permissions` resolve the many-to-many relationships. Staff permissions are explicitly assigned.
3. **Skill evidence:** a `sharing_skill` can have several verification attempts. Evidence files belong to one verification attempt. `user_learned_skills` is separate from verified sharing skills.
4. **Repeated time slots:** `request_preferred_slots` and `proposal_candidate_slots` replace array-valued form fields. They are suggestions and do not create Sessions.
5. **Schedule version history:** `schedule_proposals` stores current status/version; `schedule_versions` retains version snapshots; `schedule_items` and `schedule_confirmations` belong to a specific version. Confirmation flags are derived from the two confirmation rows for the current version.
6. **Two-sided commitment:** `held_credit_allocations` has one row per `user_id + session_id`. A locked schedule normally creates two allocations per Session, one for each participant.
7. **Session completion:** `session_confirmations` records each participant's response independently. `session_attendance` is optional LiveKit-derived evidence, not completion proof.
8. **Credit ledger:** `credit_transactions` records both Available and Held deltas and resulting balances. Payment callbacks, schedule holds, release, settlement, penalty, and adjustment must be idempotent.
9. **Reports:** `report_cases.target_type + target_id` supports targets of several entity types; `related_session_id` and `related_transaction_id` provide direct references for cases affecting Held Credit. Other polymorphic target existence is validated by the application/service layer.
10. **File metadata:** message and report attachments are separate child tables with protected storage keys; file bytes are outside the relational model.

## Required relational constraints

| Table | Constraint |
|---|---|
| `users` | Unique normalized lowercase `email`; `failed_login_count >= 0`. |
| `profiles` | `user_id` is both PK and FK to `users`; `reputation_score BETWEEN 0 AND 100`; counters nonnegative. |
| `user_roles` | Composite PK `(user_id, role_id)`; `assigned_by_user_id` may be null for SYSTEM. |
| `role_permissions` | Composite PK `(role_id, permission_id)`. |
| `oauth_accounts` | Composite unique `(provider, provider_account_id)`; prevent unsafe automatic account linking by email alone. |
| `skills` | Unique normalized `name` and `slug`; referenced skills are archived/inactivated instead of hard deleted. |
| `sharing_skills` | At most one active row per `(user_id, skill_id)`; `experience_years BETWEEN 0 AND 60`. |
| `skill_verifications` | At most one PENDING verification per `sharing_skill_id`; REJECTED requires a 10–500 character reason. |
| `skill_evidence` | 1–5 files per verification submission; file size `<= 10 MB`, allowed actual MIME only. |
| `learning_requests` | `owner_id <> proposer_id` is enforced when creating a Proposal; duration 30–240 in 30-minute steps; `expires_at` in allowed range. |
| `request_preferred_slots` | `end_at > start_at`; at most five slots per request. |
| `proposals` | At most one PENDING row per `(request_id, proposer_id)`; proposer must have matching Sharing Skill; duration and credit limits follow SRS. |
| `proposal_candidate_slots` | `end_at > start_at`; at most five slots per Proposal. |
| `conversations` | Unique `proposal_id`; `participant_a_id <> participant_b_id`; participants must match the accepted Proposal/Request. |
| `schedule_proposals` | `participant_a_id <> participant_b_id`; `current_version >= 1`; Proposal must be ACCEPTED. |
| `schedule_versions` | Composite PK `(schedule_proposal_id, version_no)`; version number positive. |
| `schedule_items` | Composite FK `(schedule_proposal_id, version_no)` to `schedule_versions`; unique `(schedule_proposal_id, version_no, session_no)`; `end_at > start_at`; `session_credit >= MIN_SESSION_CREDIT`. |
| `schedule_confirmations` | Composite PK `(schedule_proposal_id, version_no, user_id)`; composite FK to `schedule_versions`; only the two Schedule Proposal participants may confirm. |
| `sessions` | Unique `schedule_item_id`; `participant_a_id <> participant_b_id`; created only from a LOCKED version after final validation and two-sided Hold. |
| `session_confirmations` | Composite PK `(session_id, user_id)`; only Session participants may confirm. |
| `livekit_rooms` | Unique `session_id` and `room_name`; token/secret is not stored in this table. |
| `credit_wallets` | One wallet per User; Available/Held/Purchased/Bonus balances nonnegative; optimistic update with `wallet_version`. |
| `held_credit_allocations` | Unique `(user_id, session_id)`; `0 <= remaining_held <= amount`; User must be a Session participant. |
| `credit_transactions` | Unique non-null `idempotency_key`; immutable successful ledger entries; balance deltas and after-balances must reconcile with the wallet. |
| `payments` | Unique `external_order_ref`; unique `(gateway, gateway_transaction_id)` when callback ID is present; PAID can create one successful TOP_UP only. |
| `withdrawals` | Positive amount, eligible balance only; protected bank account value; reserve Credit on request and release on valid rejection/cancellation. |
| `reviews` | Unique `(session_id, reviewer_id)`; reviewer/reviewee are the two distinct participants; rating between 1 and 5; Session must be eligible. |
| `reputation_history` | Both scores between 0 and 100; User cannot edit score directly. |
| `report_cases` | Target exists and reporter is permitted to report it; resolution fields required when RESOLVED; credit-related case keeps relevant Held Credit until resolution. |
| `notifications` | Only recipient may update `read_at`; payload/body must not expose secrets. |
| `audit_logs` | Append-only; do not log passwords, OTPs, complete tokens, CVV or unnecessary sensitive data. |

## Critical transaction boundaries

1. **Lock schedule:** require two confirmations for the same current version, validate every item for both users, validate request/proposal state and both balances, then create Sessions, create both users' Held allocations, append HOLD transactions, update both wallets, and set Schedule Proposal to LOCKED atomically. Roll back the entire operation if any part fails.
2. **Settle one Session:** require valid completion and no active dispute. For each participant independently, consume that participant's allocation; return 96% to the same wallet and record 4% as platform fee. Use an idempotency key containing `session_id + user_id + settlement`. Rounding policy requires Product Owner approval.
3. **Cancel/dispute:** apply the configured policy to each User's own Held allocation and append RELEASE, REFUND, PENALTY or ADJUSTMENT entries as needed. Never rewrite older CreditTransaction rows.
4. **Top-up:** only a verified, idempotent Payment Gateway callback can set Payment to PAID and append TOP_UP/update wallet.

## Deferred product decisions

The SRS leaves production values for minimum Session Credit, daily/feedback bonus, cancellation/no-show penalties, dispute and confirmation windows, withdrawal eligibility, Reputation formula, join window and integer rounding to Product Owner approval. `system_configurations` supports these values without hard-coding them.
