"""Generate editable SkillHub v2 conceptual/logical models for SRS 1.5.

Read v1 catalog without modifying it. PostgreSQL and MongoDB ownership
is explicit. Run with the bundled Python runtime; Pillow is used for previews.
"""

from collections import OrderedDict
from html import escape
import hashlib
import importlib.util
from pathlib import Path
import tempfile
from xml.etree import ElementTree as ET

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("logical_v1", HERE / "generate_logical_model.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
concept_spec = importlib.util.spec_from_file_location("conceptual_v1", HERE / "generate_conceptual_model.py")
concept_base = importlib.util.module_from_spec(concept_spec)
concept_spec.loader.exec_module(concept_base)
TABLES = OrderedDict((name, columns) for lane in base.LANES for name, columns in lane)
for name in ("otp_challenges", "withdrawals", "user_roles", "profiles", "session_attendance"):
    del TABLES[name]


def table(name, columns):
    TABLES[name] = columns.strip()


table("users", """
PK user_id: UUID
FK NN role_id: UUID
UQ NN normalized_email: VARCHAR(254)
password_hash: TEXT
NN account_status: ENUM
NN email_verified: BOOLEAN
NN security_version: INTEGER
NN failed_login_count: INTEGER
last_login_at: TIMESTAMP
NN terms_version: VARCHAR(40)
NN terms_accepted_at: TIMESTAMP
NN full_name: VARCHAR(100)
headline: VARCHAR(120)
bio: VARCHAR(1000)
FK avatar_asset_id: UUID
timezone: VARCHAR(64)
NN locale: ENUM
NN reputation_score: SMALLINT = 50
NN verified_skill_count: INTEGER
NN completed_session_count: INTEGER
NN created_at / updated_at: TIMESTAMP
""")
table("roles", """
PK role_id: UUID
UQ NN code: USER / STAFF / ADMIN
description: VARCHAR(255)
""")
table("refresh_sessions", """
PK session_id: UUID
FK NN user_id: UUID
NN security_version: INTEGER
NN current_generation: INTEGER
NN remember_me: BOOLEAN
NN absolute_expires_at: TIMESTAMP
revoked_at / revoked_reason: TIMESTAMP / TEXT
device_metadata: JSON
NN created_at: TIMESTAMP
""")
table("refresh_credentials", """
PK credential_id: UUID
FK NN session_id: UUID
NN generation: INTEGER
UQ NN token_digest: BYTEA
NN expires_at: TIMESTAMP
used_at / revoked_at: TIMESTAMP
NN created_at: TIMESTAMP
""")
table("reauth_proofs", """
PK proof_id: UUID
FK NN user_id: UUID
FK NN session_id: UUID
NN purpose: ENUM
UQ NN token_digest: BYTEA
NN security_version: INTEGER
NN expires_at: TIMESTAMP
used_at: TIMESTAMP
NN created_at: TIMESTAMP
""")
table("avatar_assets", """
PK asset_id: UUID
FK NN user_id: UUID
UQ NN storage_key: TEXT
NN status: ENUM
NN mime_type: VARCHAR(100)
NN size_bytes: BIGINT
NN checksum: TEXT
NN created_at: TIMESTAMP
""")
table("identity_email_deliveries", """
PK delivery_id: UUID
FK user_id: UUID
NN kind: ENUM
UQ NN dedupe_key: TEXT
NN status: ENUM
NN expires_at: TIMESTAMP
NN attempts: INTEGER
next_attempt_at / lease_until: TIMESTAMP
provider_message_id: TEXT
NN created_at: TIMESTAMP
sent_at: TIMESTAMP
""")
table("skill_evidence", TABLES["skill_evidence"] + """
NN approval_status: ENUM
FK reviewer_id: UUID
reviewed_at / approved_at: TIMESTAMP
reject_reason: VARCHAR(500)
FK revoked_by_user_id: UUID
revoked_at / revoked_reason: TIMESTAMP / TEXT
NN scan_status: ENUM
NN checksum: TEXT
""")
table("user_learned_skills", """
PK learned_skill_id: UUID
FK NN user_id: UUID
FK NN skill_id: UUID
FK NN source_path_id: UUID
FK NN source_plan_id: UUID
NN completed_at: TIMESTAMP
NN completion_rule_version: VARCHAR(40)
""")
table("learning_requests", """
PK request_id: UUID
FK NN owner_id: UUID
FK NN skill_id: UUID
NN title: VARCHAR(120)
NN description: VARCHAR(3000)
NN learning_goal: VARCHAR(1000)
NN preferred_slots: JSON array = [] [max 5]
current_level: ENUM
NN verified_teacher_only: BOOLEAN
NN content_version: INTEGER
NN moderation_status: ENUM
flagged_rules: JSON
reject_reason: VARCHAR(500)
FK reviewed_by_user_id: UUID
reviewed_at / expires_at: TIMESTAMP
NN status: ENUM
NN created_at / updated_at: TIMESTAMP
""")
table("proposals", """
PK proposal_id: UUID
NN source_type: ENUM
FK request_id: UUID
FK NN proposer_id: UUID
FK NN recipient_id: UUID
FK NN skill_id: UUID
NN message: VARCHAR(1000)
NN candidate_slots: JSON array = [] [max 5]
proposed_duration_minutes: SMALLINT
proposed_credit: BIGINT units
initial_session_count: SMALLINT
expires_at: TIMESTAMP
NN status: ENUM
NN created_at: TIMESTAMP
""")
table("conversations", """
PK conversation_id: UUID
UQ FK NN proposal_id: UUID
FK request_id: UUID
FK NN participant_a_id: UUID
FK NN participant_b_id: UUID
NN created_at: TIMESTAMP
""")
table("learning_paths", """
PK path_id: UUID
FK NN conversation_id: UUID
FK NN participant_a_id: UUID
FK NN participant_b_id: UUID
NN current_version: INTEGER
locked_version: INTEGER
NN status: ENUM
NN created_at / updated_at: TIMESTAMP
completed_at: TIMESTAMP
FK settled_path_version: INTEGER
UQ FK settlement_operation_id: UUID
FK settlement_fee_policy_id: UUID
settlement_exchange_type: ENUM
settlement_gross_amount: BIGINT units
settlement_fee_amount: BIGINT units
settlement_fee_snapshot: JSON
settled_at: TIMESTAMP
""")
table("learning_path_versions", """
PK FK path_id: UUID
PK version_no: INTEGER
NN exchange_type: TWO_WAY / ONE_WAY
total_credit_per_user: BIGINT units
negotiated_credit: BIGINT units
FK teacher_id / learner_id: UUID
FK fee_policy_id: UUID
fee_rate_snapshot: DECIMAL
fee_amount_snapshot: BIGINT units
rounding_snapshot: JSON
participant_a_confirmed_at: TIMESTAMP
participant_b_confirmed_at: TIMESTAMP
FK NN created_by_user_id: UUID
NN created_at: TIMESTAMP
""")
table("learning_plans", """
PK plan_id: UUID
FK NN path_id: UUID
FK NN teacher_id: UUID
FK NN learner_id: UUID
FK NN created_by_user_id: UUID
NN current_version: INTEGER
NN status: ENUM
NN created_at / updated_at: TIMESTAMP
""")
table("learning_plan_versions", """
PK FK plan_id: UUID
PK version_no: INTEGER
FK NN skill_id: UUID
NN learning_goal: VARCHAR(1500)
NN total_sessions: INTEGER
learner_confirmed_at: TIMESTAMP
NN created_at: TIMESTAMP
""")
table("plan_session_outlines", """
PK FK plan_id: UUID
PK FK plan_version: INTEGER
PK session_no: INTEGER
NN content: TEXT
""")
table("plan_confirmations", """
PK FK plan_id: UUID
PK FK plan_version: INTEGER
FK NN learner_id: UUID
NN confirmed_at: TIMESTAMP
""")
table("path_version_plans", """
PK FK path_id: UUID
PK FK path_version: INTEGER
PK FK plan_id: UUID
FK NN plan_version: INTEGER
""")
table("path_confirmations", """
PK FK path_id: UUID
PK FK path_version: INTEGER
PK FK user_id: UUID
NN confirmed_at: TIMESTAMP
""")
table("schedule_proposals", """
PK schedule_proposal_id: UUID
FK NN path_id: UUID
NN current_version: INTEGER
applied_version: INTEGER
NN status: ENUM
NN created_at: TIMESTAMP
""")
table("schedule_versions", """
PK FK schedule_proposal_id: UUID
PK version_no: INTEGER
FK NN path_id: UUID
FK NN path_version: INTEGER
participant_a_confirmed_at: TIMESTAMP
participant_b_confirmed_at: TIMESTAMP
FK NN created_by_user_id: UUID
NN created_at: TIMESTAMP
""")
table("schedule_items", """
PK schedule_item_id: UUID
FK NN schedule_proposal_id: UUID
FK NN schedule_version: INTEGER
FK NN plan_id: UUID
FK NN plan_version: INTEGER
FK NN session_no: INTEGER
NN start_at / end_at: TIMESTAMP
""")
table("sessions", """
PK session_id: UUID
FK NN path_id: UUID
FK NN plan_id: UUID
FK NN plan_version: INTEGER
FK NN outline_session_no: INTEGER
FK NN teacher_id: UUID
FK NN learner_id: UUID
NN start_at / end_at: TIMESTAMP
NN status: ENUM
FK cancelled_by_user_id: UUID
cancelled_at / cancel_reason: TIMESTAMP / TEXT
teacher_confirmation_status: ENUM
teacher_confirmed_at: TIMESTAMP
teacher_confirmation_note: VARCHAR(1000)
learner_confirmation_status: ENUM
learner_confirmed_at: TIMESTAMP
learner_confirmation_note: VARCHAR(1000)
UQ room_name: VARCHAR(255)
provider_room_id: STRING
room_metadata: JSON
teacher_first_joined_at: TIMESTAMP
teacher_last_left_at: TIMESTAMP
NN teacher_attendance_seconds: BIGINT = 0
learner_first_joined_at: TIMESTAMP
learner_last_left_at: TIMESTAMP
NN learner_attendance_seconds: BIGINT = 0
""")
table("session_schedule_history", """
PK history_id: UUID
FK NN session_id: UUID
UQ FK NN schedule_item_id: UUID
NN applied_at: TIMESTAMP
superseded_at: TIMESTAMP
""")
table("held_credit_allocations", """
PK allocation_id: UUID
FK NN user_id: UUID
FK NN path_id: UUID
FK NN locked_path_version: INTEGER
FK beneficiary_id: UUID
NN purpose: COMMITMENT / TEACHING_PAYMENT
NN amount: BIGINT units
NN remaining_held: BIGINT units
NN status: ENUM
NN created_at: TIMESTAMP
settled_at: TIMESTAMP
""")
table("fee_policy_versions", """
PK policy_id: UUID
NN policy_code: TWO_WAY / ONE_WAY / MATERIAL_PAID
NN version_no: INTEGER
NN calculation_rule: JSON
NN rounding_rule: JSON
NN status: ENUM
approved_at / effective_at: TIMESTAMP
FK approved_by_user_id: UUID
""")
table("credit_operations", """
PK operation_id: UUID
NN operation_type: ENUM
NN reference_type: ENUM
NN reference_id: UUID / STRING
UQ NN idempotency_key: VARCHAR(255)
NN status: ENUM
NN created_at: TIMESTAMP
""")
table("credit_transactions", """
PK transaction_id: UUID
FK NN user_id: UUID
FK NN operation_id: UUID
NN entry_no: INTEGER
NN type: ENUM
NN amount: BIGINT units
NN available_delta / held_delta: BIGINT units
NN available_after / held_after: BIGINT units
FK reverses_transaction_id: UUID
NN status: ENUM
UQ NN idempotency_key: VARCHAR(255)
NN created_at: TIMESTAMP
""")
table("credit_wallets", TABLES["credit_wallets"].replace(": BIGINT", ": BIGINT units"))
table("payments", TABLES["payments"].replace("credit_amount: BIGINT", "credit_amount: BIGINT units") + "\nNN conversion_rate_vnd_per_credit: INTEGER = 1000")
table("materials", """
PK material_id: UUID
FK NN owner_id: UUID
FK NN skill_id: UUID
NN title: VARCHAR(150)
NN description: VARCHAR(3000)
NN access_type: FREE / PAID
NN price_credit: BIGINT units
UQ storage_key: TEXT
original_filename: TEXT
mime_type: VARCHAR(100)
size_bytes: BIGINT
checksum: TEXT
scan_status: ENUM
distribution_rights_confirmed_at: TIMESTAMP
uploaded_at: TIMESTAMP
NN listing_version: INTEGER
NN moderation_status: ENUM
NN status: ENUM
FK reviewed_by_user_id: UUID
reviewed_at / reject_reason: TIMESTAMP / TEXT
NN created_at / updated_at: TIMESTAMP
""")
table("material_orders", """
PK order_id: UUID
FK NN buyer_id / seller_id: UUID
FK NN material_id: UUID
NN purchased_file_snapshot: JSON
NN listing_version: INTEGER
NN gross_credit / fee_amount: BIGINT units
NN seller_net_credit: BIGINT units
FK NN fee_policy_id: UUID
NN fee_snapshot: JSON
UQ FK NN operation_id: UUID
NN status: ENUM
UQ NN idempotency_key: VARCHAR(255)
NN created_at: TIMESTAMP
""")
table("material_entitlements", """
PK entitlement_id: UUID
FK NN user_id / material_id: UUID
UQ FK source_order_id: UUID
NN source_type: FREE / PURCHASE
NN status: ENUM
NN granted_at: TIMESTAMP
revoked_at / revoked_reason: TIMESTAMP / TEXT
""")
table("reviews", TABLES["reviews"].replace("session_id", "path_id"))
table("reputation_history", """
PK reputation_history_id: UUID
FK NN user_id: UUID
NN score_before / score_after: SMALLINT
NN delta: SMALLINT
NN reason_code: ENUM
NN rule_version: VARCHAR(40)
NN source_type / source_id: STRING
UQ NN event_key: VARCHAR(255)
NN created_at: TIMESTAMP
""")
table("user_restrictions", """
PK restriction_id: UUID
FK NN user_id: UUID
NN scope: ENUM
NN reason_code: ENUM
NN starts_at / ends_at: TIMESTAMP
NN source_type / source_id: STRING
FK applied_by_user_id: UUID
revoked_at: TIMESTAMP
""")
table("report_cases", TABLES["report_cases"] + """
FK related_path_id: UUID
FK related_material_id: UUID
FK related_order_id: UUID
NN blocks_settlement: BOOLEAN
""")
table("audit_logs", TABLES["audit_logs"].replace("NN actor_role:", "actor_role:"))
table("outbox_events", """
PK event_id: UUID
NN aggregate_type / aggregate_id: STRING
NN aggregate_version: INTEGER
NN event_type: VARCHAR(100)
NN payload: JSON [no secrets]
UQ NN dedupe_key: TEXT
NN created_at: TIMESTAMP
published_at: TIMESTAMP
NN attempts: INTEGER
""")
table("messages", """
PK message_id: STRING
REF NN conversation_id: UUID [PostgreSQL]
REF sender_id: UUID [PostgreSQL]
message_text: VARCHAR(2000)
NN message_type: STRING
NN attachments: JSON array = [] [embedded file metadata]
REF object_type / object_id: STRING
REF object_version: INTEGER
UQ event_id: UUID [business event]
NN sent_at: TIMESTAMP
read_at: TIMESTAMP
""")
table("message_attachments", """
PK attachment_id: STRING
REF NN message_id: STRING [MongoDB]
NN mime_type: VARCHAR(100)
NN storage_key: TEXT
NN file_size_bytes: INTEGER [max 15 MB]
NN scan_status: ENUM
NN checksum: TEXT
""")
MERGED_MODELS = {
    "plan_confirmations": "learning_plan_versions",
    "path_confirmations": "learning_path_versions",
    "schedule_confirmations": "schedule_versions",
    "session_confirmations": "sessions",
    "request_preferred_slots": "learning_requests",
    "proposal_candidate_slots": "proposals",
    "livekit_rooms": "sessions",
    "message_attachments": "messages",
}
for name in MERGED_MODELS:
    del TABLES[name]

# Keep v1's one-field-per-row representation instead of compressed pairs.
for name, columns in TABLES.items():
    expanded = []
    for line in columns.splitlines():
        if ":" not in line or line.startswith("KEY "):
            expanded.append(line)
            continue
        fields, types = line.split(":", 1)
        if " / " not in fields:
            expanded.append(line)
            continue
        parts = fields.split(" / ")
        first_tokens = parts[0].split()
        markers = " ".join(first_tokens[:-1])
        parts[0] = first_tokens[-1]
        data_types = types.strip().split(" / ")
        assert len(data_types) in (1, len(parts)), (name, line)
        for index, field in enumerate(parts):
            data_type = data_types[0] if len(data_types) == 1 else data_types[index]
            expanded.append(f"{markers + ' ' if markers else ''}{field}: {data_type}")
    TABLES[name] = "\n".join(expanded)

DOMAINS = OrderedDict([
    ("Identity", "users roles permissions role_permissions oauth_accounts refresh_sessions refresh_credentials reauth_proofs avatar_assets identity_email_deliveries".split()),
    ("Skills", "skill_categories skills sharing_skills skill_verifications skill_evidence user_learned_skills".split()),
    ("Negotiation", "learning_requests proposals request_preferred_slots proposal_candidate_slots conversations".split()),
    ("Learning agreements", "learning_paths learning_path_versions learning_plans learning_plan_versions plan_session_outlines plan_confirmations path_version_plans path_confirmations".split()),
    ("Scheduling and sessions", "schedule_proposals schedule_versions schedule_items schedule_confirmations sessions session_schedule_history session_confirmations livekit_rooms".split()),
    ("Credit and payments", "credit_wallets held_credit_allocations fee_policy_versions credit_operations credit_transactions payments".split()),
    ("Materials", "materials material_orders material_entitlements".split()),
    ("Trust and operations", "reviews reputation_history user_restrictions report_cases report_evidence notifications audit_logs system_configurations outbox_events".split()),
    ("Chat MongoDB", "messages message_attachments".split()),
])
DOMAINS = OrderedDict((domain, [n for n in names if n not in MERGED_MODELS]) for domain, names in DOMAINS.items())
STORE = {n: ("MongoDB" if d == "Chat MongoDB" else "PostgreSQL") for d, names in DOMAINS.items() for n in names}

# parent, child, label, cardinality at parent, cardinality at child; optional
# parent markers mean the child's FK is nullable. Cross-store references dashed.
RELATIONS = []


def relation(parent, child, label, child_card="0..N", parent_card="1"):
    RELATIONS.append((parent, child, label, parent_card, child_card))


for p, c, label, card in base.RELATIONS:
    if p not in TABLES or c not in TABLES:
        continue
    if (p, c) in {
        ("schedule_proposals", "user_learned_skills"), ("conversations", "schedule_proposals"),
        ("proposals", "schedule_proposals"), ("users", "schedule_proposals"),
        ("schedule_items", "sessions"), ("skills", "sessions"),
        ("sessions", "held_credit_allocations"), ("schedule_proposals", "held_credit_allocations"),
        ("sessions", "reviews"),
    }:
        continue
    parent_card = "0..1" if (p, c) in {("learning_requests", "proposals"), ("learning_requests", "conversations"), ("users", "messages"), ("users", "audit_logs")} else "1"
    relation(p, c, label, {"N": "0..N", "1": "1", "0..1": "0..1"}[card], parent_card)

EXTRA = [
    ("roles", "users", "one role per user"),
    ("users", "refresh_credentials", "via session (derived)"),
    ("refresh_sessions", "refresh_credentials", "token generations"),
    ("users", "reauth_proofs", "owns proof"), ("refresh_sessions", "reauth_proofs", "bound to user + session"),
    ("users", "avatar_assets", "owns avatar files"), ("avatar_assets", "users", "selected owned avatar", "0..1", "0..1"),
    ("users", "identity_email_deliveries", "delivery recipient", "0..N", "0..1"),
    ("users", "proposals", "receives direct/request proposal"), ("skills", "proposals", "proposed skill"),
    ("conversations", "learning_paths", "negotiates agreement"), ("users", "learning_paths", "A/B participants"),
    ("learning_paths", "learning_path_versions", "version snapshots"),
    ("learning_paths", "learning_plans", "draft 0..2; lock 1 or 2"),
    ("users", "learning_plans", "teacher / learner / author"),
    ("learning_plans", "learning_plan_versions", "retains content versions"),
    ("skills", "learning_plan_versions", "skill taught"),
    ("learning_plan_versions", "plan_session_outlines", "one outline per session"),
    ("learning_plan_versions", "plan_confirmations", "learner confirms version", "0..1"),
    ("users", "plan_confirmations", "learner only"),
    ("learning_path_versions", "path_version_plans", "selects plan snapshots"),
    ("learning_plan_versions", "path_version_plans", "included version"),
    ("learning_path_versions", "path_confirmations", "A/B confirm same version"),
    ("users", "path_confirmations", "participant confirmation"),
    ("learning_paths", "schedule_proposals", "schedules agreement"),
    ("learning_path_versions", "schedule_versions", "confirmed terms version"),
    ("plan_session_outlines", "schedule_items", "schedules plan + outline"),
    ("learning_paths", "sessions", "agreement progress"),
    ("plan_session_outlines", "sessions", "stable planned session", "0..1"),
    ("sessions", "session_schedule_history", "applied schedule history"),
    ("schedule_items", "session_schedule_history", "applied item", "0..1"),
    ("learning_path_versions", "held_credit_allocations", "locked commitment version"),
    ("learning_paths", "held_credit_allocations", "TWO_WAY 2; ONE_WAY 1 at lock"),
    ("learning_path_versions", "learning_paths", "settled owned version", "0..N", "0..1"),
    ("fee_policy_versions", "learning_path_versions", "approved fee snapshot", "0..N", "0..1"),
    ("fee_policy_versions", "learning_paths", "settlement policy", "0..N", "0..1"),
    ("credit_operations", "learning_paths", "final settlement operation", "0..1", "0..1"),
    ("credit_operations", "credit_transactions", "groups debit/credit/fee"),
    ("credit_transactions", "credit_transactions", "reversal references original", "0..N", "0..1"),
    ("learning_paths", "reviews", "review after whole agreement"),
    ("learning_paths", "user_learned_skills", "completed agreement source"),
    ("learning_plans", "user_learned_skills", "grant learner skill only"),
    ("users", "materials", "owns distribution"), ("skills", "materials", "primary skill"),
    ("materials", "material_orders", "purchase history"),
    ("users", "material_orders", "buyer / seller"),
    ("fee_policy_versions", "material_orders", "approved fee snapshot"),
    ("credit_operations", "material_orders", "purchase operation", "0..1"),
    ("materials", "material_entitlements", "user access rights"),
    ("users", "material_entitlements", "receives rights"),
    ("material_orders", "material_entitlements", "purchase grants access", "0..1", "0..1"),
    ("users", "user_restrictions", "timed activity restrictions"),
    ("learning_paths", "report_cases", "learning dispute context", "0..N", "0..1"),
    ("materials", "report_cases", "material report context", "0..N", "0..1"),
    ("material_orders", "report_cases", "order dispute context", "0..N", "0..1"),
]
for item in EXTRA:
    if item[0] in TABLES and item[1] in TABLES:
        relation(*item)
# Do not present a derived User->credential shortcut as a foreign key.
RELATIONS = [r for r in RELATIONS if not (r[0] == "users" and r[1] == "refresh_credentials")]

NOTES = {
    "Identity": "PostgreSQL | Profile fields merged into User; no Profile table. One Role per User; Reputation starts at 50 (range 0-100). Composite avatar/proof ownership checks required; selected avatar must belong to the same User. Public profile responses project only allowed fields, excluding identity secrets/security metadata. Reputation and counters remain server-managed.",
    "Skills": "PostgreSQL | Evidence approval is per file; new uploads do not revoke old approvals. No automatic expiry. SkillTag and its request/material joins are removed by user decision. SkillCategory and Skill remain; request/material filtering uses their existing skill_id, with no extra tags or replacement tag arrays. Learned skill is granted only to each plan's learner after path completion.",
    "Negotiation": "PostgreSQL | Direct proposal has recipient/skill, no request required. ACCEPTED opens Chat only. Moderation approval binds contentVersion; editing reruns moderation. Proposed price/duration are suggestions, not committed terms.",
    "Learning agreements": "PostgreSQL | TWO_WAY: exactly A->B and B->A plans, each learner confirms, then A+B confirm the same pathVersion. ONE_WAY: one teacher->learner plan. Immutable snapshots; 20 Credit/User applies to whole TWO_WAY agreement, not each plan.",
    "Scheduling and sessions": "PostgreSQL | Duration 60-180 minutes. One stable Session per plan outline; schedule history preserves reschedules. Two confirmations >=60 minutes before old startAt. Pending revision does not replace applied schedule or HOLD again. No per-session settlement.",
    "Credit and payments": "PostgreSQL | All Credit amounts use BIGINT units: 100 units = 1 Credit; VND remains integer. HOLD by path/user: TWO_WAY both users, ONE_WAY learner only. ONE_WAY/material fee policy must be approved. One final settlement/path; ledger+wallet+state atomic.",
    "Materials": "PostgreSQL | FREE price=0; PAID price>0. Current file metadata lives on Material; draft file fields nullable, PUBLISHED requires complete metadata and CLEAN. No MaterialVersion model or version FKs. Order stores immutable purchased_file_snapshot: {storageKey, originalFilename, mimeType, sizeBytes, checksum, distributionRightsConfirmedAt, uploadedAt}. Retain sold objects without overwriting/deleting them while access applies; scan blocking remains enforced. Purchase snapshot+ledger+entitlement atomic. Unique user/material entitlement prevents repeat charge. Access to replacement files/refund/hidden policies remains open.",
    "Trust and operations": "PostgreSQL | Review unique path/reviewer, after whole agreement. Reputation 50, range 0-100. Material reports need no path/session. Outbox metadata excludes secrets; successful ledger/audit are append-only.",
    "Chat MongoDB": "MongoDB / Mongoose | Documents refer to PostgreSQL by application-validated IDs, never cross-store FKs. Attachment max 15 MB. Business confirmations stay in PostgreSQL. System events dedupe by eventId through committed outbox delivery.",
}

NOTES["Negotiation"] += " preferred_slots/candidate_slots are embedded arrays (max 5): {startAt, endAt}, UTC, startAt < endAt; they are suggestions only."
NOTES["Learning agreements"] += " Confirmation timestamps are nullable fields on each version; actors derive from fixed plan/path participants. New versions start unconfirmed."
NOTES["Learning agreements"] += " PathSettlement is merged into LearningPath: settlement fields all NULL before settlement, all required after settlement. Unique settlement_operation_id; composite (path_id, settled_path_version) FK to owned PathVersion. One immutable final settlement/path, atomically with ledger/wallet/allocation/status; lock the path and guard settled_at IS NULL for concurrent retries."
NOTES["Scheduling and sessions"] += " ScheduleVersion stores A/B confirmation timestamps. Session stores teacher/learner confirmation status, timestamp and note, plus unique nullable room_name, provider_room_id and room_metadata. No room secrets/tokens."
NOTES["Scheduling and sessions"] += " SessionAttendance is merged into Session: teacher/learner first_joined_at, last_left_at and attendance_seconds (nonnegative, default 0). Timestamps nullable until observed. Duration is actual connected time summed across reconnects, not lastLeft-firstJoin; avoid overlapping connection double-counts. Only verified provider data updates summaries; ingestion must handle duplicate/out-of-order events. No detailed join/leave history is modeled; attendance does not complete a Session."
NOTES["Chat MongoDB"] += " Message embeds attachments: {attachmentId, mimeType, storageKey, fileSizeBytes, scanStatus, checksum}; attachmentId unique within each message; validate each file's size/scan status and authorize downloads."

# Conceptual view hides implementation-level history/security/join tables.
CONCEPTS = OrderedDict([
    ("Identity", "users roles permissions role_permissions oauth_accounts refresh_sessions".split()),
    ("Skills", "skill_categories skills sharing_skills skill_verifications skill_evidence user_learned_skills".split()),
    ("Negotiation", "learning_requests proposals conversations".split()),
    ("Learning agreements", "learning_paths learning_plans".split()),
    ("Scheduling and sessions", "schedule_proposals schedule_items sessions session_confirmations livekit_rooms".split()),
    ("Credit and payments", "credit_wallets held_credit_allocations credit_transactions payments fee_policy_versions".split()),
    ("Materials", "materials material_orders material_entitlements".split()),
    ("Trust and operations", "reviews reputation_history user_restrictions report_cases notifications audit_logs system_configurations".split()),
    ("Chat MongoDB", "messages message_attachments".split()),
])
CONCEPTS = OrderedDict((domain, [n for n in names if n not in MERGED_MODELS]) for domain, names in CONCEPTS.items())
LABELS = {
    "users": "User", "roles": "Role", "permissions": "Permission",
    "role_permissions": "RolePermission", "oauth_accounts": "OAuthAccount",
    "refresh_sessions": "RefreshSession", "skill_categories": "SkillCategory", "skills": "Skill",
    "sharing_skills": "SharingSkill", "skill_verifications": "SkillVerification",
    "skill_evidence": "SkillEvidence", "user_learned_skills": "UserLearnedSkill", "learning_requests": "LearningRequest",
    "proposals": "Proposal", "conversations": "Conversation", "learning_paths": "LearningPath",
    "learning_plans": "LearningPlan", "schedule_proposals": "ScheduleProposal", "schedule_items": "ScheduleItem",
    "sessions": "Session", "session_confirmations": "SessionConfirmation", "livekit_rooms": "LiveKitRoom",
    "credit_wallets": "CreditWallet",
    "held_credit_allocations": "HeldCreditAllocation", "credit_transactions": "CreditTransaction",
    "payments": "Payment", "fee_policy_versions": "FeePolicy",
    "materials": "Material", "material_orders": "MaterialOrder",
    "material_entitlements": "MaterialEntitlement", "reviews": "Review", "reputation_history": "ReputationHistory",
    "user_restrictions": "UserRestriction",
    "report_cases": "ReportDispute", "notifications": "Notification", "audit_logs": "AuditLog",
    "system_configurations": "SystemConfiguration", "messages": "Message", "message_attachments": "MessageAttachment",
}


def conceptual_relations():
    visible = {n for names in CONCEPTS.values() for n in names}
    rels = [r for r in RELATIONS if r[0] in visible and r[1] in visible]
    for r in [
        ("learning_plans", "sessions", "teaches one learner", "1", "0..N"),
        ("schedule_proposals", "schedule_items", "confirmed schedule items", "1", "0..N"),
        ("schedule_items", "sessions", "applied schedule (history retained)", "0..1", "0..1"),
        ("learning_paths", "held_credit_allocations", "TWO_WAY 2 / ONE_WAY 1 at lock", "1", "0..N"),
        ("material_orders", "credit_transactions", "atomic debit/credit/fee", "0..1", "0..N"),
        ("learning_paths", "credit_transactions", "final settlement entries via operation", "0..1", "0..N"),
        ("skills", "learning_plans", "plan teaches skill", "1", "0..N"),
    ]:
        if not any(x[:2] == r[:2] for x in rels):
            rels.append(r)
    return rels


MARKERS = {"1": "ERone", "0..1": "ERzeroToOne", "0..N": "ERzeroToMany", "1..N": "ERmany"}


def validate():
    names = [n for ns in DOMAINS.values() for n in ns]
    assert len(names) == len(set(names)) and set(names) == set(TABLES)
    for a, b, _, ac, bc in RELATIONS:
        assert a in TABLES and b in TABLES
        assert ac in MARKERS and bc in MARKERS
    assert not any(n.startswith("otp_") for n in TABLES)
    assert "withdrawals" not in TABLES
    assert "user_roles" not in TABLES
    assert "achievements" not in TABLES and "user_achievements" not in TABLES
    assert "profiles" not in TABLES
    assert "selected_achievement_id" not in TABLES["users"]
    assert len([line for line in TABLES["users"].splitlines() if "updated_at:" in line]) == 1
    assert ("avatar_assets", "users", "selected owned avatar", "0..1", "0..1") in RELATIONS
    assert "FK NN role_id: UUID" in TABLES["users"]
    assert ("roles", "users", "one role per user", "1", "0..N") in RELATIONS
    assert "session_id" not in TABLES["reviews"]
    assert "session_id" not in TABLES["held_credit_allocations"]
    assert "session_credit" not in "\n".join(TABLES.values())
    assert len(TABLES) == 49 and sum(s == "PostgreSQL" for s in STORE.values()) == 48
    assert "session_attendance" not in TABLES
    assert not ({"skill_tags", "learning_request_tags", "material_tags"} & set(TABLES))
    assert "path_settlements" not in TABLES
    assert ("credit_operations", "learning_paths", "final settlement operation", "0..1", "0..1") in RELATIONS
    assert "material_versions" not in TABLES
    assert not any(field in "\n".join(TABLES.values()) for field in ("current_file_version_id", "purchased_version_id", "granted_version_id", "version_scope"))
    assert "NN purchased_file_snapshot: JSON" in TABLES["material_orders"]
    assert "UQ storage_key: TEXT" in TABLES["materials"]
    assert not (set(MERGED_MODELS) & set(TABLES))
    for name, fields in {
        "learning_paths": ["settled_path_version", "settlement_operation_id", "settlement_fee_policy_id", "settlement_exchange_type", "settlement_gross_amount", "settlement_fee_amount", "settlement_fee_snapshot", "settled_at"],
        "users": ["full_name", "headline", "bio", "avatar_asset_id", "timezone", "locale", "reputation_score", "verified_skill_count", "completed_session_count"],
        "learning_plan_versions": ["learner_confirmed_at"],
        "learning_path_versions": ["participant_a_confirmed_at", "participant_b_confirmed_at"],
        "schedule_versions": ["participant_a_confirmed_at", "participant_b_confirmed_at"],
        "sessions": ["teacher_confirmed_at", "learner_confirmed_at", "teacher_confirmation_status", "learner_confirmation_status", "room_name", "provider_room_id", "room_metadata", "teacher_first_joined_at", "teacher_last_left_at", "teacher_attendance_seconds", "learner_first_joined_at", "learner_last_left_at", "learner_attendance_seconds"],
        "learning_requests": ["preferred_slots"], "proposals": ["candidate_slots"], "messages": ["attachments"],
    }.items():
        for field in fields:
            assert any(line.split(":", 1)[0].split()[-1] == field for line in TABLES[name].splitlines()), (name, field)


def make_canvas(mxfile, conceptual):
    """Keep the v1 one-canvas presentation, shapes, fonts and original positions."""
    kind = "conceptual" if conceptual else "logical"
    domains = CONCEPTS if conceptual else DOMAINS
    names = [n for group in domains.values() for n in group]
    relations = conceptual_relations() if conceptual else RELATIONS
    positions = {}
    bottoms = [90, 90, 90, 90]
    new_index = 0
    for name in names:
        lines = [] if conceptual else TABLES[name].splitlines()
        width = concept_base.BOX_WIDTH if conceptual else base.TABLE_WIDTH
        height = concept_base.BOX_HEIGHT if conceptual else 44 + len(lines) * 19 + 18
        old = concept_base.NODES.get(LABELS[name]) if conceptual else base.BASE_POSITIONS.get(name)
        if old is not None:
            x, y = old
        else:
            col = new_index % 4
            x = (2180 if conceptual else 7200) + col * (350 if conceptual else 650)
            y = bottoms[col]
            bottoms[col] += height + (78 if conceptual else 100)
            new_index += 1
        positions[name] = (x, y, width, height, False, lines)
    page_width = max(x + w for x, y, w, h, ext, lines in positions.values()) + 100
    page_height = max(y + h for x, y, w, h, ext, lines in positions.values()) + 120
    diagram = ET.SubElement(mxfile, "diagram", {"id": f"skillhub-{kind}-v2", "name": f"SkillHub {kind.title()} Data Model v2"})
    model = ET.SubElement(diagram, "mxGraphModel", {
        "dx": "1600", "dy": "900", "grid": "1", "gridSize": "10", "guides": "1",
        "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
        "pageScale": "1", "pageWidth": str(page_width), "pageHeight": str(page_height),
        "math": "0", "shadow": "0",
    })
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    for index, (a, b, label, ac, bc) in enumerate(relations):
        if conceptual:
            style = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748B;strokeWidth=1.4;fontColor=#20334D;fontSize=12;labelBackgroundColor=#FFFFFF;labelBorderColor=none;"
            marker_size = 18
        else:
            style = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#52657B;strokeWidth=1.7;fontColor=#172D48;fontSize=14;labelBackgroundColor=#FFFFFF;"
            marker_size = 20
        style += f"startArrow={MARKERS[ac]};endArrow={MARKERS[bc]};startFill=0;endFill=0;startSize={marker_size};endSize={marker_size};exitPerimeter=1;entryPerimeter=1;"
        old_positions = {n: (x, y, h) for n, (x, y, w, h, ext, lines) in positions.items()}
        style += base.ports(a, b, old_positions)
        if STORE[a] != STORE[b]:
            style += "dashed=1;"
        cell = ET.SubElement(root, "mxCell", {"id": f"relation-{index}", "value": label, "edge": "1", "parent": "1", "source": f"entity-{a}", "target": f"entity-{b}", "style": style})
        ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
    for name, (x, y, width, height, ext, lines) in positions.items():
        title = LABELS[name] if conceptual else name
        if STORE[name] != "PostgreSQL":
            title += ("\n" if conceptual else " ") + f"[{STORE[name]}]"
        if conceptual:
            value = escape(title).replace("\n", "<br>")
            style = "shape=mxgraph.er.entity;buttonStyle=rect;buttonText=;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fillColor=#FFFFFF;strokeColor=#3F668F;strokeWidth=1.8;fontColor=#162D47;fontSize=16;fontStyle=1;shadow=0;"
        else:
            rows = "<br>".join(escape(line) for line in lines)
            value = (
                "<table cellpadding='0' cellspacing='0' style='width:100%;height:100%;font-family:Arial;'>"
                f"<tr style='height:48px'><td align='center' style='font-size:17px;border-bottom:1px solid #111111'><b>{escape(title)}</b></td></tr>"
                f"<tr><td align='left' valign='top' style='padding:8px 12px;font-size:13px;line-height:1.35'>{rows}</td></tr></table>"
            )
            style = "shape=mxgraph.er.entityExt;rounded=1;container=1;collapsible=1;buttonText=;subText=;whiteSpace=wrap;html=1;overflow=fill;align=left;verticalAlign=top;fillColor=#FFFFFF;strokeColor=#111111;strokeWidth=2;fontColor=#111111;fontSize=13;shadow=0;"
        cell = ET.SubElement(root, "mxCell", {"id": f"entity-{name}", "value": value, "style": style, "vertex": "1", "parent": "1"})
        ET.SubElement(cell, "mxGeometry", {"x": str(x), "y": str(y), "width": str(width), "height": str(height), "as": "geometry"})
        if not conceptual:
            divider = ET.SubElement(root, "mxCell", {"id": f"divider-{name}", "value": "", "style": "shape=line;strokeColor=#111111;strokeWidth=2;connectable=0;movable=0;resizable=0;rotatable=0;", "vertex": "1", "parent": f"entity-{name}", "connectable": "0"})
            ET.SubElement(divider, "mxGeometry", {"x": "0", "y": "48", "width": str(width), "height": "1", "as": "geometry"})
    return positions, relations, page_width, page_height


def previews(pages, kind, output):
    """Geometric previews of the generated model, not a draw.io renderer."""
    from PIL import Image, ImageDraw, ImageFont
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    normal = ImageFont.truetype(str(font_path), 13)
    bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 16 if kind == "conceptual" else 17)
    for domain, (positions, relations, width, height) in pages:
        im = Image.new("RGB", (width, height), "white")
        draw = ImageDraw.Draw(im)
        for a, b, label, ac, bc in relations:
            ax, ay, aw, ah, *_ = positions[a]
            bx, by, bw, bh, *_ = positions[b]
            if a == b:
                continue
            start, end = (ax + aw / 2, ay + ah / 2), (bx + bw / 2, by + bh / 2)
            mid_x = (start[0] + end[0]) / 2
            draw.line([start, (mid_x, start[1]), (mid_x, end[1]), end], fill="#A6B0BE", width=2)
        for name, (x, y, w, h, ext, lines) in positions.items():
            stroke = "#3F668F" if kind == "conceptual" else "#111111"
            draw.rounded_rectangle((x, y, x + w, y + h), radius=0 if kind == "conceptual" else 10, fill="white", outline=stroke, width=2)
            title = LABELS.get(name, name) if kind == "conceptual" else name
            if STORE[name] != "PostgreSQL":
                title += ("\n" if kind == "conceptual" else " ") + f"[{STORE[name]}]"
            for title_row, title_line in enumerate(title.splitlines()):
                title_width = draw.textlength(title_line, font=bold)
                assert title_width <= w - 20, (name, title)
                title_y = 12 if kind == "logical" or "\n" in title else 22
                draw.text((x + (w - title_width) / 2, y + title_y + title_row * 20), title_line, fill=stroke, font=bold)
            if kind == "logical":
                draw.line((x, y + 48, x + w, y + 48), fill=stroke, width=2)
            for row, text in enumerate(lines):
                assert draw.textlength(text, font=normal) <= w - 24, (name, text)
                draw.text((x + 12, y + 58 + row * 19), text, fill="#111111", font=normal)
        im.save(output / f"{kind}-{domain.lower().replace(' ', '-')}.png")


def write_model(conceptual):
    kind = "conceptual" if conceptual else "logical"
    mxfile = ET.Element("mxfile", {"host": "app.diagrams.net", "agent": "Codex", "version": "24.7.17", "type": "device"})
    pages = []
    domains = CONCEPTS if conceptual else DOMAINS
    relations = conceptual_relations() if conceptual else RELATIONS
    for domain in ("Canvas",):
        page = make_canvas(mxfile, conceptual)
        pages.append((domain, page))
        rects = page[0]
        for a, (ax, ay, aw, ah, *_) in rects.items():
            for b, (bx, by, bw, bh, *_) in rects.items():
                if a < b:
                    assert not (ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah), (domain, a, b)
    out = HERE / f"SkillHub_{kind.title()}_Data_Model_v2.drawio"
    ET.indent(mxfile)
    ET.ElementTree(mxfile).write(out, encoding="utf-8", xml_declaration=True)
    parsed = ET.parse(out)
    for diagram in parsed.getroot().findall("diagram"):
        cells = diagram.findall(".//mxCell")
        ids = [c.get("id") for c in cells]
        assert len(ids) == len(set(ids))
        for cell in cells:
            if cell.get("edge") == "1":
                assert cell.get("source") in ids and cell.get("target") in ids
    print(f"Wrote {out.name}: {len(pages)} pages; {sum(len(ns) for ns in domains.values())} primary entities")
    return kind, pages


def main():
    validate()
    original = [HERE / n for n in ("SkillHub_Conceptual_Data_Model.drawio", "SkillHub_Logical_Data_Model.drawio", "generate_conceptual_model.py", "generate_logical_model.py")]
    before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in original}
    output = Path(tempfile.gettempdir()) / "skillhub-model-v2-previews"
    output.mkdir(exist_ok=True)
    for conceptual in (True, False):
        kind, pages = write_model(conceptual)
        previews(pages, kind, output)
    write_field_catalog()
    assert before == {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in original}
    print(f"Validated references, store ownership, no box overlap; originals unchanged. Previews: {output}")


def write_field_catalog():
    proposed = {
        "learning_path_versions",
        "learning_plan_versions", "plan_session_outlines", "plan_confirmations", "path_version_plans",
        "path_confirmations", "session_schedule_history", "fee_policy_versions", "credit_operations",
        "user_restrictions", "outbox_events",
    }
    lines = [
        "# SkillHub Entities and Fields v2", "",
        "Field catalog for SRS 1.5 with the user's scope adjustments. Generated by `generate_data_models_v2.py`.", "",
        "This is a logical design, not an inventory of deployed tables. Definitions match the single-canvas `SkillHub_Logical_Data_Model_v2.drawio`, using the v1 presentation style.", "",
        "48 PostgreSQL tables and 1 MongoDB document concept. SessionAttendance summaries are merged into Session. SkillTag and its request/material joins are removed; SkillCategory and Skill remain. Profile fields are merged into User; PathSettlement fields are merged into LearningPath. Eight owned models are merged into their parents: version/session confirmation fields, suggestion arrays, Session room metadata and embedded Message attachments. MaterialVersion is removed: current file metadata is on Material, purchased file snapshots are on MaterialOrder. Each User has exactly one Role through required users.role_id; UserRole is removed. Achievement, selected title and OTP structures are excluded by user decision. Existing identity helpers are retained; history/join/operation structures implement requirements using proposed normalization.", "",
        "PK = primary key; FK = same-store relational reference; UQ = column uniqueness; NN = required. REF = application reference without a PostgreSQL FK. Composite uniqueness and checks are specified in `SkillHub_Logical_Data_Model_v2.md`.", "",
        "Credit BIGINT values are hundredths of Credit (100 units = 1 Credit). VND and file sizes are unscaled integers. TIMESTAMP means UTC. ENUM values not listed inline are defined by the accompanying constraints/state vocabulary; open policies are not invented defaults.", "",
        "Diagrams list one field per row, like v1. This catalog is a logical design, not executable DDL.", "",
    ]
    for domain, names in DOMAINS.items():
        lines += [f"## {domain}", "", NOTES[domain], ""]
        for name in names:
            classification = "Proposed technical structure" if name in proposed else "Requirements concept or existing identity structure"
            lines += [f"### {name}", "", f"Store: **{STORE[name]}**. {classification}.", "", "| Field | Kiểu / quy tắc | Nguồn |", "|---|---|---|"]
            for field_line in TABLES[name].splitlines():
                if field_line.startswith("KEY "):
                    field, details = "Redis key", field_line[4:]
                elif ":" in field_line:
                    field, details = field_line.split(":", 1)
                else:
                    field, details = "Rule", field_line
                lines.append(f"| `{field.strip()}` | {details.strip()} | {classification} |")
            lines.append("")
    (HERE / "SkillHub_Entities_Fields_v2.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
