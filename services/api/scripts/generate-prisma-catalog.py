"""Rebuild the PostgreSQL catalog from logical v3; never migrate a database.

Run from repository root with Python. Open ENUM vocabularies remain String.
Prisma formatting/validation run separately via pnpm --filter api.
"""
from pathlib import Path
import importlib.util
import re

ROOT = Path(__file__).resolve().parents[3]
PRISMA = ROOT / "services/api/prisma"
spec = importlib.util.spec_from_file_location("logical_v3", ROOT / "docs/generate_data_models_v3.py")
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
catalog.validate()

NAMES = dict(catalog.LABELS)
NAMES.update({
    "refresh_credentials": "RefreshCredential", "reauth_proofs": "ReauthProof",
    "avatar_assets": "AvatarAsset", "identity_email_deliveries": "IdentityEmailDelivery",
    "learning_path_versions": "LearningPathVersion", "learning_plan_versions": "LearningPlanVersion",
    "plan_session_outlines": "PlanSessionOutline", "path_version_plans": "PathVersionPlan",
    "schedule_versions": "ScheduleVersion", "session_schedule_history": "SessionScheduleHistory",
    "fee_policy_versions": "FeePolicyVersion", "credit_operations": "CreditOperation",
    "report_cases": "ReportCase", "report_evidence": "ReportEvidence", "outbox_events": "OutboxEvent",
})

ENUMS = {
    "AccountStatus": "PENDING_VERIFICATION ACTIVE SUSPENDED LOCKED DEACTIVATED",
    "RoleCode": "USER STAFF ADMIN", "UserLocale": "vi en",
    "CatalogStatus": "ACTIVE INACTIVE ARCHIVED",
    "SharingSkillLevel": "BEGINNER INTERMEDIATE ADVANCED EXPERT",
    "LearningLevel": "NONE BEGINNER INTERMEDIATE ADVANCED",
    "SkillVerificationStatus": "UNVERIFIED PENDING VERIFIED REJECTED",
    "VerificationRequestStatus": "PENDING VERIFIED REJECTED",
    "EvidenceApprovalStatus": "PENDING APPROVED REJECTED REVOKED",
    "ReauthPurpose": "STAFF_ROLE_CHANGE",
    "AvatarAssetStatus": "QUARANTINED CLEAN REJECTED DELETED",
    "EmailDeliveryStatus": "PENDING LEASED SENT FAILED EXPIRED CANCELLED",
    "LearningRequestStatus": "DRAFT PENDING_MODERATION REJECTED OPEN NEGOTIATING MATCHED CLOSED CANCELLED EXPIRED",
    "ProposalStatus": "PENDING ACCEPTED REJECTED WITHDRAWN EXPIRED",
    "ProposalSourceType": "LEARNING_REQUEST DIRECT_SEARCH",
    "LearningPathStatus": "DRAFT PROPOSED PARTIALLY_CONFIRMED CONFIRMED SCHEDULED ACTIVE COMPLETED CANCELLED DISPUTED",
    "LearningPlanStatus": "DRAFT PROPOSED CONFIRMED NEEDS_REVISION",
    "ExchangeType": "TWO_WAY ONE_WAY", "FeePolicyCode": "TWO_WAY ONE_WAY MATERIAL_PAID",
    "HoldPurpose": "COMMITMENT TEACHING_PAYMENT",
    "ScheduleProposalStatus": "DRAFT PROPOSED PARTIALLY_CONFIRMED LOCKED NEEDS_REVISION CANCELLED EXPIRED",
    "SessionStatus": "CONFIRMED READY ONGOING AWAITING_CONFIRMATION COMPLETED CANCELLED DISPUTED",
    "CreditTransactionType": "TOP_UP DAILY_BONUS FEEDBACK_BONUS HOLD RELEASE PATH_RETURN PLATFORM_FEE TEACHING_PAYMENT TEACHING_EARNING MATERIAL_PURCHASE MATERIAL_SALE REFUND PENALTY ADJUSTMENT",
    "CreditReferenceType": "PAYMENT LEARNING_PATH SESSION REVIEW DISPUTE MATERIAL_ORDER SYSTEM",
    "CreditTransactionStatus": "PENDING SUCCESS FAILED REVERSED",
    "PaymentStatus": "CREATED PENDING PAID FAILED EXPIRED REFUNDED",
    "MaterialAccessType": "FREE PAID",
    "MaterialStatus": "DRAFT PENDING_REVIEW PUBLISHED REJECTED HIDDEN ARCHIVED",
    "EntitlementSourceType": "FREE PURCHASE",
    "ReportTargetType": "USER SESSION REVIEW MESSAGE LEARNING_REQUEST CREDIT_TRANSACTION MATERIAL MATERIAL_ORDER",
    "ReportCaseStatus": "OPEN UNDER_REVIEW NEED_MORE_INFO RESOLVED REJECTED CLOSED",
    "NotificationChannel": "IN_APP EMAIL",
}
ENUM_FIELDS = {
    "users": {"account_status": "AccountStatus", "locale": "UserLocale"},
    "roles": {"code": "RoleCode"},
    "skill_categories": {"status": "CatalogStatus"}, "skills": {"status": "CatalogStatus"},
    "sharing_skills": {"level": "SharingSkillLevel", "verification_status": "SkillVerificationStatus"},
    "skill_verifications": {"status": "VerificationRequestStatus"},
    "skill_evidence": {"approval_status": "EvidenceApprovalStatus"},
    "reauth_proofs": {"purpose": "ReauthPurpose"},
    "avatar_assets": {"status": "AvatarAssetStatus"},
    "identity_email_deliveries": {"status": "EmailDeliveryStatus"},
    "learning_requests": {"current_level": "LearningLevel", "status": "LearningRequestStatus"},
    "proposals": {"source_type": "ProposalSourceType", "status": "ProposalStatus"},
    "learning_paths": {"status": "LearningPathStatus", "settlement_exchange_type": "ExchangeType"},
    "learning_path_versions": {"exchange_type": "ExchangeType"},
    "learning_plans": {"status": "LearningPlanStatus"},
    "schedule_proposals": {"status": "ScheduleProposalStatus"}, "sessions": {"status": "SessionStatus"},
    "held_credit_allocations": {"purpose": "HoldPurpose"},
    "fee_policy_versions": {"policy_code": "FeePolicyCode"},
    "credit_operations": {"reference_type": "CreditReferenceType"},
    "credit_transactions": {"type": "CreditTransactionType", "status": "CreditTransactionStatus"},
    "payments": {"status": "PaymentStatus"},
    "materials": {"access_type": "MaterialAccessType", "status": "MaterialStatus"},
    "material_entitlements": {"source_type": "EntitlementSourceType"},
    "report_cases": {"target_type": "ReportTargetType", "status": "ReportCaseStatus"},
    "notifications": {"channel": "NotificationChannel"},
}

def camel(name):
    first, *rest = name.split("_")
    return first + "".join(part.title() for part in rest)

tables = {}
for table, columns in catalog.TABLES.items():
    if catalog.STORE[table] != "PostgreSQL":
        continue
    fields = {}
    for line in columns.splitlines():
        left, dtype = line.split(":", 1)
        *markers, name = left.split()
        fields[name] = {"markers": markers, "dtype": dtype.strip(), "name": camel(name)}
    pks = [name for name, f in fields.items() if "PK" in f["markers"]]
    if len(pks) == 1 and "FK" not in fields[pks[0]]["markers"]:
        fields[pks[0]]["name"] = "key" if table == "system_configurations" else "id"
    tables[table] = {"fields": fields, "pks": pks, "relations": [], "unique": [], "indexes": []}

def unique(table, *fields):
    key = list(fields)
    if key not in tables[table]["unique"]:
        tables[table]["unique"].append(key)

for table, keys in {
    "oauth_accounts": [("provider", "provider_account_id")],
    "refresh_credentials": [("session_id", "generation")],
    "refresh_sessions": [("user_id", "session_id")],
    "avatar_assets": [("user_id", "asset_id")],
    "users": [("user_id", "avatar_asset_id")],
    "skill_verifications": [("verification_id", "sharing_skill_id")],
    "user_learned_skills": [("user_id", "skill_id", "source_plan_id")],
    "learning_plans": [("path_id", "teacher_id", "learner_id"), ("plan_id", "path_id")],
    "learning_paths": [("path_id", "settled_path_version")],
    "schedule_proposals": [("schedule_proposal_id", "path_id")],
    "schedule_items": [("schedule_proposal_id", "schedule_version", "plan_id", "plan_version", "session_no")],
    "sessions": [("plan_id", "plan_version", "outline_session_no")],
    "session_schedule_history": [("session_id", "schedule_item_id")],
    "held_credit_allocations": [("path_id", "user_id")],
    "fee_policy_versions": [("policy_code", "version_no")],
    "credit_transactions": [("operation_id", "entry_no")],
    "payments": [("gateway", "gateway_transaction_id")],
    "material_entitlements": [("user_id", "material_id")],
    "reviews": [("path_id", "reviewer_id")],
}.items():
    for key in keys:
        unique(table, *key)

covered = set()
def relation(child, fields, parent, refs=None, label=None):
    fields = fields.split()
    refs = refs.split() if refs else tables[parent]["pks"]
    assert len(fields) == len(refs), (child, fields, parent, refs)
    label = label or "_".join(fields)
    relation_name = NAMES[child] + "_" + label
    optional = any(not ({"PK", "NN"} & set(tables[child]["fields"][f]["markers"])) for f in fields)
    attrs = f'@relation("{relation_name}", fields: [{", ".join(tables[child]["fields"][f]["name"] for f in fields)}], references: [{", ".join(tables[parent]["fields"][f]["name"] for f in refs)}], onDelete: Restrict, onUpdate: Restrict)'
    field_name = camel(label) + "Record"
    tables[child]["relations"].append(f'  {field_name} {NAMES[parent]}{"?" if optional else ""} {attrs}')
    is_unique = (set(fields) >= set(tables[child]["pks"]) or
                 any(set(fields) >= set(key) for key in tables[child]["unique"]) or
                 any("UQ" in tables[child]["fields"][f]["markers"] for f in fields))
    inverse = NAMES[child][0].lower() + NAMES[child][1:] + camel(label)[0].upper() + camel(label)[1:] + "Records"
    tables[parent]["relations"].append(f'  {inverse} {NAMES[child]}{"?" if is_unique else "[]"} @relation("{relation_name}")')
    tables[child]["indexes"].append(fields)
    covered.update((child, f) for f in fields if "FK" in tables[child]["fields"][f]["markers"])

PLAN_PATH_KEY = "plan_id path_id"
PATH_VERSION_KEY = "path_id version_no"
OUTLINE_KEY = "plan_id plan_version session_no"

# Composite relations preserve version membership and file/proof ownership.
for args in [
    ("users", "user_id avatar_asset_id", "avatar_assets", "user_id asset_id", "selected_avatar"),
    ("reauth_proofs", "user_id session_id", "refresh_sessions", "user_id session_id", "bound_session"),
    ("skill_evidence", "verification_id sharing_skill_id", "skill_verifications", "verification_id sharing_skill_id", "submission"),
    ("user_learned_skills", "source_plan_id source_path_id", "learning_plans", PLAN_PATH_KEY, "source_plan"),
    ("learning_paths", "path_id settled_path_version", "learning_path_versions", PATH_VERSION_KEY, "settled_version"),
    ("learning_path_versions", "path_id", "learning_paths"),
    ("learning_plan_versions", "plan_id", "learning_plans"),
    ("plan_session_outlines", "plan_id plan_version", "learning_plan_versions", "plan_id version_no", "plan_version"),
    ("path_version_plans", "path_id path_version", "learning_path_versions", PATH_VERSION_KEY, "path_version"),
    ("path_version_plans", "plan_id plan_version", "learning_plan_versions", "plan_id version_no", "plan_version"),
    ("path_version_plans", PLAN_PATH_KEY, "learning_plans", PLAN_PATH_KEY, "owned_plan"),
    ("schedule_versions", "schedule_proposal_id path_id", "schedule_proposals", "schedule_proposal_id path_id", "proposal"),
    ("schedule_versions", "path_id path_version", "learning_path_versions", PATH_VERSION_KEY, "path_version"),
    ("schedule_items", "schedule_proposal_id schedule_version", "schedule_versions", "schedule_proposal_id version_no", "schedule_version"),
    ("schedule_items", OUTLINE_KEY, "plan_session_outlines", OUTLINE_KEY, "outline"),
    ("sessions", "plan_id plan_version outline_session_no", "plan_session_outlines", OUTLINE_KEY, "outline"),
    ("sessions", PLAN_PATH_KEY, "learning_plans", PLAN_PATH_KEY, "owned_plan"),
    ("held_credit_allocations", "path_id locked_path_version", "learning_path_versions", PATH_VERSION_KEY, "locked_version"),
    ("credit_transactions", "user_id", "credit_wallets"),
]:
    relation(*args)

targets = {
    "user_id": "users", "role_id": "roles", "permission_id": "permissions",
    "category_id": "skill_categories", "parent_category_id": "skill_categories",
    "skill_id": "skills", "sharing_skill_id": "sharing_skills", "verification_id": "skill_verifications",
    "request_id": "learning_requests", "proposal_id": "proposals", "conversation_id": "conversations",
    "path_id": "learning_paths", "plan_id": "learning_plans", "session_id": "sessions",
    "schedule_proposal_id": "schedule_proposals", "schedule_item_id": "schedule_items",
    "operation_id": "credit_operations", "settlement_operation_id": "credit_operations",
    "fee_policy_id": "fee_policy_versions", "settlement_fee_policy_id": "fee_policy_versions",
    "material_id": "materials", "source_order_id": "material_orders", "case_id": "report_cases",
    "reverses_transaction_id": "credit_transactions", "related_transaction_id": "credit_transactions",
    "related_path_id": "learning_paths", "related_session_id": "sessions",
    "related_material_id": "materials", "related_order_id": "material_orders",
    "source_path_id": "learning_paths", "source_plan_id": "learning_plans",
}
user_refs = {"owner_id", "proposer_id", "recipient_id", "participant_a_id", "participant_b_id", "teacher_id", "learner_id", "reviewer_id", "reviewee_id", "buyer_id", "seller_id", "beneficiary_id", "reporter_id", "handler_id", "actor_id"}
for table, data in tables.items():
    for field, info in data["fields"].items():
        if "FK" not in info["markers"] or (table, field) in covered:
            continue
        if field in user_refs or field.endswith("_by_user_id"):
            target = "users"
        elif table in ("refresh_credentials", "reauth_proofs") and field == "session_id":
            target = "refresh_sessions"
        else:
            target = targets[field]
        relation(table, field, target)

def scalar_type(table, name, dtype):
    enum = ENUM_FIELDS.get(table, {}).get(name)
    attrs = []
    if enum:
        kind = enum
    elif dtype.startswith("UUID") and "STRING" not in dtype:
        kind = "String"; attrs.append("@db.Uuid")
    else:
        kind, attrs = native_scalar_type(dtype)
    return kind, attrs


def native_scalar_type(dtype):
    attrs = []
    for prefix, kind, native in (
        ("BIGINT", "BigInt", None),
        ("SMALLINT", "Int", "@db.SmallInt"),
        ("INTEGER", "Int", None),
        ("TIMESTAMP", "DateTime", "@db.Timestamptz(3)"),
        ("BOOLEAN", "Boolean", None),
        ("BYTEA", "Bytes", "@db.ByteA"),
        ("JSON", "Json", None),
    ):
        if dtype.startswith(prefix):
            return kind, [native] if native else []
    if dtype.startswith("DECIMAL"):
        attrs.append("@db.Decimal" + (dtype[7:] if "(" in dtype else "(12, 8)"))
        return "Decimal", attrs
    return "String", [string_native_type(dtype)]


def string_native_type(dtype):
    match = re.match(r"(VARCHAR|CHAR)\((\d+)\)", dtype)
    if not match:
        return "@db.Text"
    native = "VarChar" if match[1] == "VARCHAR" else "Char"
    return f"@db.{native}({match[2]})"


def field_attributes(table, name, markers, dtype, kind, attrs):
    if "PK" in markers and len(tables[table]["pks"]) == 1:
        attrs.insert(0, "@id")
        if kind == "String" and "@db.Uuid" in attrs and "FK" not in markers:
            attrs.append("@default(uuid())")
    if "UQ" in markers:
        attrs.append("@unique")
    if " = " in dtype:
        default = dtype.split(" = ", 1)[1].split(" [", 1)[0]
        attrs.append('@default("[]")' if default == "[]" else f"@default({default})")
    if name == "created_at":
        attrs.append("@default(now())")
    if name == "updated_at":
        attrs.append("@updatedAt")
    attrs.append(f'@map("{name}")')
    return attrs


def scalar(table, name, info):
    markers, dtype = info["markers"], info["dtype"]
    enum = ENUM_FIELDS.get(table, {}).get(name)
    kind, attrs = scalar_type(table, name, dtype)
    attrs = field_attributes(table, name, markers, dtype, kind, attrs)
    required = "PK" in markers or "NN" in markers
    comment = "  // Open vocabulary; owning feature must validate it before release.\n" if dtype == "ENUM" and not enum else ""
    return comment + f'  {info["name"]} {kind}{"" if required else "?"} {" ".join(attrs)}'

chunks = [
    "// Logical v3 catalog: 48 PostgreSQL models. Generated by scripts/generate-prisma-catalog.py.\n"
    "// This catalog is separate from the legacy identity runtime schema/migrations.\n"
    "// All Credit BigInt amounts use 100 units = 1 Credit. No database is changed by generation.",
    'generator client {\n  provider = "prisma-client"\n  output = "../src/generated/prisma-catalog"\n  moduleFormat = "cjs"\n}',
    'datasource db {\n  provider = "postgresql"\n}',
]
used_enums = {enum for mapping in ENUM_FIELDS.values() for enum in mapping.values()}
chunks.extend(f'enum {name} {{\n  ' + "\n  ".join(values.split()) + "\n}" for name, values in ENUMS.items() if name in used_enums)
for table, data in tables.items():
    lines = [f"model {NAMES[table]} {{"]
    lines.extend(scalar(table, name, info) for name, info in data["fields"].items())
    lines.extend(["", *data["relations"], ""])
    def mapped(fields):
        return ", ".join(data["fields"][f]["name"] for f in fields)
    if len(data["pks"]) > 1:
        lines.append(f'  @@id([{mapped(data["pks"])}])')
    for key in data["unique"]:
        lines.append(f'  @@unique([{mapped(key)}])')
    for index in data["indexes"]:
        if index not in data["unique"] and index != data["pks"]:
            lines.append(f'  @@index([{mapped(index)}])')
    lines.extend([f'  @@map("{table}")', "}"])
    chunks.append("\n".join(lines))
assert len(tables) == 48
assert all((table, field) in covered for table, data in tables.items() for field, info in data["fields"].items() if "FK" in info["markers"])
(PRISMA / "catalog.prisma").write_text("\n\n".join(chunks) + "\n", encoding="utf-8")
print(f"Generated {len(tables)} PostgreSQL models; all logical FK fields covered.")

readme = """# SkillHub Prisma catalog — logical v3

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

| Logical table | Prisma model | Store |
|---|---|---|
"""
readme += "\n".join(f"| `{table}` | `{NAMES[table]}` | PostgreSQL |" for table in tables)
readme += "\n| `messages` | `Message` (embedded attachments) | MongoDB reference |\n"
(PRISMA / "README.md").write_text(readme, encoding="utf-8")
