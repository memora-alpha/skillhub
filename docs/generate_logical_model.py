"""Generate the SkillHub logical data model in editable draw.io XML."""

from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

OUTPUT = Path(__file__).with_name("SkillHub_Logical_Data_Model.drawio")
TABLE_WIDTH = 450

# Lane order follows the business lifecycle. PK, FK, UQ, and NN markers are
# visible in every table; all data types are database-neutral logical types.
LANES = [
    [
        ("users", """PK user_id: UUID
UQ NN email: VARCHAR(254)
password_hash: VARCHAR(255)
NN account_status: ENUM
NN email_verified: BOOLEAN
NN failed_login_count: INTEGER
last_login_at: TIMESTAMP
NN terms_version: VARCHAR(40)
NN terms_accepted_at: TIMESTAMP
NN created_at: TIMESTAMP
NN updated_at: TIMESTAMP"""),
        ("profiles", """PK FK user_id: UUID
NN full_name: VARCHAR(100)
headline: VARCHAR(120)
bio: VARCHAR(1000)
avatar_storage_key: VARCHAR(500)
NN timezone: VARCHAR(64)
NN locale: ENUM
NN reputation_score: SMALLINT
NN verified_skill_count: INTEGER
NN completed_session_count: INTEGER"""),
        ("roles", """PK role_id: UUID
UQ NN name: VARCHAR(40)
description: VARCHAR(255)"""),
        ("user_roles", """PK FK user_id: UUID
PK FK role_id: UUID
NN assigned_at: TIMESTAMP
FK assigned_by_user_id: UUID"""),
        ("permissions", """PK permission_id: UUID
UQ NN code: VARCHAR(100)
description: VARCHAR(255)"""),
        ("role_permissions", """PK FK role_id: UUID
PK FK permission_id: UUID"""),
        ("otp_challenges", """PK challenge_id: UUID
FK user_id: UUID
NN email: VARCHAR(254)
NN purpose: ENUM
NN otp_hash: VARCHAR(255)
NN expires_at: TIMESTAMP
used_at: TIMESTAMP
NN failed_attempts: SMALLINT
NN resend_count: SMALLINT
last_sent_at: TIMESTAMP"""),
        ("oauth_accounts", """PK oauth_account_id: UUID
FK NN user_id: UUID
NN provider: ENUM
NN provider_account_id: VARCHAR(255)
NN linked_at: TIMESTAMP"""),
        ("refresh_sessions", """PK refresh_session_id: UUID
FK NN user_id: UUID
UQ NN refresh_token_hash: VARCHAR(255)
NN expires_at: TIMESTAMP
revoked_at: TIMESTAMP
NN created_at: TIMESTAMP"""),
    ],
    [
        ("skill_categories", """PK category_id: UUID
UQ NN name: VARCHAR(100)
UQ NN slug: VARCHAR(120)
NN status: ENUM
FK parent_category_id: UUID"""),
        ("skills", """PK skill_id: UUID
UQ NN name: VARCHAR(100)
UQ NN slug: VARCHAR(120)
FK category_id: UUID
description: VARCHAR(500)
NN status: ENUM"""),
        ("sharing_skills", """PK sharing_skill_id: UUID
FK NN user_id: UUID
FK NN skill_id: UUID
NN level: ENUM
NN description: VARCHAR(1500)
experience_years: DECIMAL(3,1)
NN verification_status: ENUM
NN is_visible: BOOLEAN
archived_at: TIMESTAMP"""),
        ("skill_verifications", """PK verification_id: UUID
FK NN sharing_skill_id: UUID
NN status: ENUM
FK reviewer_id: UUID
reviewed_at: TIMESTAMP
note: VARCHAR(500)
reject_reason: VARCHAR(500)
NN submitted_at: TIMESTAMP"""),
        ("skill_evidence", """PK evidence_id: UUID
FK NN verification_id: UUID
FK NN sharing_skill_id: UUID
title: VARCHAR(120)
description: VARCHAR(500)
NN mime_type: VARCHAR(100)
NN storage_key: VARCHAR(500)
NN file_size_bytes: BIGINT
NN uploaded_at: TIMESTAMP"""),
        ("user_learned_skills", """PK learned_skill_id: UUID
FK NN user_id: UUID
FK NN skill_id: UUID
FK NN schedule_proposal_id: UUID
NN completed_at: TIMESTAMP
NN completion_rule_version: VARCHAR(40)"""),
    ],
    [
        ("learning_requests", """PK request_id: UUID
FK NN owner_id: UUID
FK NN skill_id: UUID
NN title: VARCHAR(120)
NN description: VARCHAR(3000)
NN learning_goal: VARCHAR(1000)
current_level: ENUM
NN expected_duration_minutes: SMALLINT
budget_credit: BIGINT
NN verified_teacher_only: BOOLEAN
expires_at: TIMESTAMP
NN status: ENUM
NN created_at: TIMESTAMP"""),
        ("request_preferred_slots", """PK slot_id: UUID
FK NN request_id: UUID
NN start_at: TIMESTAMP
NN end_at: TIMESTAMP"""),
        ("proposals", """PK proposal_id: UUID
FK NN request_id: UUID
FK NN proposer_id: UUID
NN message: VARCHAR(1000)
NN proposed_duration_minutes: SMALLINT
proposed_credit: BIGINT
initial_session_count: SMALLINT
expires_at: TIMESTAMP
NN status: ENUM
NN created_at: TIMESTAMP"""),
        ("proposal_candidate_slots", """PK slot_id: UUID
FK NN proposal_id: UUID
NN start_at: TIMESTAMP
NN end_at: TIMESTAMP"""),
        ("conversations", """PK conversation_id: UUID
UQ FK NN proposal_id: UUID
FK NN request_id: UUID
FK NN participant_a_id: UUID
FK NN participant_b_id: UUID
NN created_at: TIMESTAMP"""),
        ("messages", """PK message_id: UUID
FK NN conversation_id: UUID
FK sender_id: UUID
message_text: VARCHAR(2000)
NN message_type: ENUM
NN sent_at: TIMESTAMP
read_at: TIMESTAMP"""),
        ("message_attachments", """PK attachment_id: UUID
FK NN message_id: UUID
NN mime_type: VARCHAR(100)
NN storage_key: VARCHAR(500)
NN file_size_bytes: BIGINT"""),
    ],
    [
        ("schedule_proposals", """PK schedule_proposal_id: UUID
FK NN proposal_id: UUID
FK NN conversation_id: UUID
FK NN participant_a_id: UUID
FK NN participant_b_id: UUID
NN current_version: INTEGER
NN status: ENUM
NN created_at: TIMESTAMP"""),
        ("schedule_versions", """PK FK schedule_proposal_id: UUID
PK version_no: INTEGER
NN total_held_credit_per_user: BIGINT
FK NN created_by_user_id: UUID
NN created_at: TIMESTAMP"""),
        ("schedule_items", """PK schedule_item_id: UUID
FK NN schedule_proposal_id: UUID
FK NN version_no: INTEGER
NN session_no: SMALLINT
NN start_at: TIMESTAMP
NN end_at: TIMESTAMP
NN session_credit: BIGINT"""),
        ("schedule_confirmations", """PK FK schedule_proposal_id: UUID
PK FK version_no: INTEGER
PK FK user_id: UUID
NN confirmed_at: TIMESTAMP"""),
        ("sessions", """PK session_id: UUID
UQ FK NN schedule_item_id: UUID
FK NN participant_a_id: UUID
FK NN participant_b_id: UUID
FK NN skill_id: UUID
NN start_at: TIMESTAMP
NN end_at: TIMESTAMP
NN session_credit: BIGINT
NN status: ENUM
FK cancelled_by_user_id: UUID
cancelled_at: TIMESTAMP
cancel_reason: VARCHAR(1000)"""),
        ("session_confirmations", """PK FK session_id: UUID
PK FK user_id: UUID
NN status: ENUM
NN confirmed_at: TIMESTAMP
note: VARCHAR(1000)"""),
        ("livekit_rooms", """PK room_id: UUID
UQ FK NN session_id: UUID
UQ NN room_name: VARCHAR(255)
metadata: JSON"""),
        ("session_attendance", """PK attendance_id: UUID
FK NN session_id: UUID
FK NN user_id: UUID
provider_event_id: VARCHAR(255)
NN joined_at: TIMESTAMP
left_at: TIMESTAMP"""),
    ],
    [
        ("credit_wallets", """PK FK user_id: UUID
NN available_credit: BIGINT
NN held_credit: BIGINT
NN purchased_credit: BIGINT
NN bonus_credit: BIGINT
NN wallet_version: INTEGER"""),
        ("held_credit_allocations", """PK allocation_id: UUID
FK NN user_id: UUID
FK NN session_id: UUID
FK NN schedule_proposal_id: UUID
NN amount: BIGINT
NN remaining_held: BIGINT
NN status: ENUM
NN created_at: TIMESTAMP
settled_at: TIMESTAMP"""),
        ("credit_transactions", """PK transaction_id: UUID
FK NN user_id: UUID
NN type: ENUM
NN amount: BIGINT
NN available_delta: BIGINT
NN held_delta: BIGINT
NN available_after: BIGINT
NN held_after: BIGINT
reference_type: ENUM
reference_id: UUID / STRING
NN status: ENUM
UQ idempotency_key: VARCHAR(255)
NN created_at: TIMESTAMP"""),
        ("payments", """PK payment_id: UUID
FK NN user_id: UUID
NN credit_amount: BIGINT
NN payment_amount_vnd: BIGINT
NN currency: CHAR(3)
NN gateway: VARCHAR(50)
UQ external_order_ref: VARCHAR(255)
gateway_transaction_id: VARCHAR(255)
NN status: ENUM
NN created_at: TIMESTAMP"""),
        ("withdrawals", """PK withdrawal_id: UUID
FK NN user_id: UUID
NN amount_credit: BIGINT
NN bank_name: VARCHAR(120)
NN bank_account_ciphertext: TEXT
NN account_holder_name: VARCHAR(100)
NN status: ENUM
NN created_at: TIMESTAMP"""),
        ("system_configurations", """PK config_key: VARCHAR(100)
NN value: JSON
NN value_type: ENUM
NN version: INTEGER
NN effective_at: TIMESTAMP
FK updated_by_user_id: UUID
NN updated_at: TIMESTAMP"""),
    ],
    [
        ("reviews", """PK review_id: UUID
FK NN session_id: UUID
FK NN reviewer_id: UUID
FK NN reviewee_id: UUID
NN rating: SMALLINT
comment: VARCHAR(1000)
NN created_at: TIMESTAMP
hidden_at: TIMESTAMP"""),
        ("reputation_history", """PK reputation_history_id: UUID
FK NN user_id: UUID
NN score_before: SMALLINT
NN score_after: SMALLINT
NN reason: VARCHAR(500)
source_type: ENUM
source_id: UUID
NN created_at: TIMESTAMP"""),
        ("report_cases", """PK case_id: UUID
FK NN reporter_id: UUID
NN target_type: ENUM
NN target_id: UUID / STRING
FK related_session_id: UUID
FK related_transaction_id: UUID
NN reason_code: ENUM
NN description: VARCHAR(2000)
NN status: ENUM
FK handler_id: UUID
resolution_code: ENUM
resolution_note: VARCHAR(2000)
FK resolved_by_user_id: UUID
resolved_at: TIMESTAMP"""),
        ("report_evidence", """PK evidence_id: UUID
FK NN case_id: UUID
NN mime_type: VARCHAR(100)
NN storage_key: VARCHAR(500)
NN file_size_bytes: BIGINT
NN uploaded_at: TIMESTAMP"""),
        ("notifications", """PK notification_id: UUID
FK NN user_id: UUID
NN type: ENUM
NN title: VARCHAR(255)
NN body: TEXT
payload: JSON
NN channel: ENUM
read_at: TIMESTAMP
NN created_at: TIMESTAMP"""),
        ("audit_logs", """PK audit_id: UUID
FK actor_id: UUID
NN actor_role: VARCHAR(40)
NN action: VARCHAR(100)
NN target_type: VARCHAR(100)
NN target_id: UUID / STRING
before_data: JSON
after_data: JSON
reason: VARCHAR(1000)
ip_address: VARCHAR(45)
user_agent: VARCHAR(500)
NN created_at: TIMESTAMP"""),
    ],
]

# Parent -> child; labels express the business relation on the line.
RELATIONS = [
    ("users", "profiles", "has profile", "1"),
    ("users", "user_roles", "receives roles", "N"),
    ("roles", "user_roles", "is assigned to users", "N"),
    ("roles", "role_permissions", "grants permissions", "N"),
    ("permissions", "role_permissions", "is granted to roles", "N"),
    ("users", "otp_challenges", "receives challenges", "N"),
    ("users", "oauth_accounts", "links providers", "N"),
    ("users", "refresh_sessions", "opens sessions", "N"),
    ("skill_categories", "skills", "groups skills", "N"),
    ("users", "sharing_skills", "offers skills", "N"),
    ("skills", "sharing_skills", "is offered as", "N"),
    ("sharing_skills", "skill_verifications", "is submitted for", "N"),
    ("skill_verifications", "skill_evidence", "contains evidence", "N"),
    ("sharing_skills", "skill_evidence", "is documented by", "N"),
    ("users", "skill_verifications", "reviews skills", "N"),
    ("users", "user_learned_skills", "completes skills", "N"),
    ("skills", "user_learned_skills", "is learned by", "N"),
    ("schedule_proposals", "user_learned_skills", "confirms learning path", "N"),
    ("users", "learning_requests", "posts requests", "N"),
    ("skills", "learning_requests", "is requested in", "N"),
    ("learning_requests", "request_preferred_slots", "prefers slots", "N"),
    ("learning_requests", "proposals", "receives proposals", "N"),
    ("users", "proposals", "submits proposals", "N"),
    ("proposals", "proposal_candidate_slots", "suggests slots", "N"),
    ("proposals", "conversations", "opens negotiation", "0..1"),
    ("learning_requests", "conversations", "is negotiated in", "N"),
    ("users", "conversations", "participates in", "N"),
    ("conversations", "messages", "contains messages", "N"),
    ("users", "messages", "sends messages", "N"),
    ("messages", "message_attachments", "has attachments", "N"),
    ("conversations", "schedule_proposals", "negotiates schedules", "N"),
    ("proposals", "schedule_proposals", "is detailed by", "N"),
    ("users", "schedule_proposals", "participates in", "N"),
    ("schedule_proposals", "schedule_versions", "has versions", "N"),
    ("users", "schedule_versions", "creates versions", "N"),
    ("schedule_versions", "schedule_items", "contains items", "N"),
    ("schedule_versions", "schedule_confirmations", "receives confirmations", "N"),
    ("users", "schedule_confirmations", "confirms version", "N"),
    ("schedule_items", "sessions", "becomes session", "0..1"),
    ("users", "sessions", "participates in", "N"),
    ("skills", "sessions", "is taught in", "N"),
    ("sessions", "session_confirmations", "requires confirmations", "N"),
    ("users", "session_confirmations", "confirms completion", "N"),
    ("sessions", "livekit_rooms", "uses room", "0..1"),
    ("sessions", "session_attendance", "records attendance", "N"),
    ("users", "session_attendance", "attends session", "N"),
    ("users", "credit_wallets", "owns wallet", "1"),
    ("users", "held_credit_allocations", "commits credit", "N"),
    ("sessions", "held_credit_allocations", "holds for each user", "N"),
    ("schedule_proposals", "held_credit_allocations", "creates holds", "N"),
    ("credit_wallets", "credit_transactions", "records transactions", "N"),
    ("users", "payments", "initiates payments", "N"),
    ("users", "withdrawals", "requests withdrawals", "N"),
    ("sessions", "reviews", "is reviewed in", "N"),
    ("users", "reviews", "writes / receives", "N"),
    ("users", "reputation_history", "accumulates reputation", "N"),
    ("users", "report_cases", "files cases", "N"),
    ("sessions", "report_cases", "may be disputed", "N"),
    ("report_cases", "report_evidence", "contains evidence", "N"),
    ("users", "notifications", "receives notices", "N"),
    ("users", "audit_logs", "performs actions", "N"),
]


BASE_POSITIONS = {
    # Identity is placed near the center because it connects to every domain.
    "users": (2300, 2050),
    "profiles": (1450, 1750),
    "roles": (300, 1500),
    "user_roles": (900, 1900),
    "permissions": (100, 2050),
    "role_permissions": (520, 2250),
    "otp_challenges": (1000, 2550),
    "oauth_accounts": (1450, 2850),
    "refresh_sessions": (500, 3000),
    # Skill records follow their verification and learning relationships.
    "skill_categories": (200, 200),
    "skills": (850, 350),
    "sharing_skills": (1500, 650),
    "skill_verifications": (1800, 150),
    "skill_evidence": (2300, 100),
    "user_learned_skills": (1600, 1120),
    # Requests and negotiation sit between skills and the schedule.
    "learning_requests": (2700, 650),
    "request_preferred_slots": (3250, 200),
    "proposals": (3350, 1100),
    "proposal_candidate_slots": (3950, 600),
    "conversations": (4150, 1500),
    "messages": (4850, 1200),
    "message_attachments": (5450, 900),
    # The schedule branches into individual Sessions and confirmations.
    "schedule_proposals": (4550, 2150),
    "schedule_versions": (5200, 1850),
    "schedule_items": (5850, 2100),
    "schedule_confirmations": (5200, 2650),
    "sessions": (5900, 3100),
    "session_confirmations": (5200, 3500),
    "livekit_rooms": (6550, 2900),
    "session_attendance": (6500, 3550),
    # Wallet, ledger, payment and case records surround the Session branch.
    "credit_wallets": (3000, 2450),
    "held_credit_allocations": (4150, 3050),
    "credit_transactions": (3600, 3650),
    "payments": (2850, 3450),
    "withdrawals": (2850, 4200),
    "system_configurations": (1950, 4200),
    "reviews": (5900, 4050),
    "reputation_history": (5000, 4200),
    "report_cases": (4650, 4800),
    "report_evidence": (5450, 4700),
    "notifications": (1800, 3450),
    "audit_logs": (2300, 4900),
}


def layout():
    tables = {name: columns for lane in LANES for name, columns in lane}
    if set(tables) != set(BASE_POSITIONS):
        raise ValueError("Every table must have exactly one layout position")
    positions = {}
    for name, columns in tables.items():
        x, y = BASE_POSITIONS[name]
        height = 44 + len(columns.splitlines()) * 19 + 18
        positions[name] = (x, y, height)
    for a, (ax, ay, ah) in positions.items():
        for b, (bx, by, bh) in positions.items():
            if a >= b:
                continue
            if ax < bx + TABLE_WIDTH + 20 and bx < ax + TABLE_WIDTH + 20 and ay < by + bh + 20 and by < ay + ah + 20:
                raise ValueError(f"Entity boxes overlap: {a}, {b}")
    return positions


def ports(a, b, positions):
    ax, ay, ah = positions[a]
    bx, by, bh = positions[b]
    dx = bx - ax
    dy = (by + bh / 2) - (ay + ah / 2)
    if abs(dx) * 0.75 > abs(dy):
        if dx > 0:
            return "exitX=1;exitY=0.5;entryX=0;entryY=0.5;"
        return "exitX=0;exitY=0.5;entryX=1;entryY=0.5;"
    if dy > 0:
        return "exitX=0.5;exitY=1;entryX=0.5;entryY=0;"
    return "exitX=0.5;exitY=0;entryX=0.5;entryY=1;"


def main():
    positions = layout()
    page_width = max(x + TABLE_WIDTH for x, _, _ in positions.values()) + 100
    page_height = max(y + h for _, y, h in positions.values()) + 120
    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net", "modified": datetime.now(timezone.utc).isoformat(),
        "agent": "Codex", "version": "24.7.17", "type": "device",
    })
    diagram = ET.SubElement(mxfile, "diagram", {"id": "skillhub-logical", "name": "SkillHub Logical Data Model"})
    model = ET.SubElement(diagram, "mxGraphModel", {
        "dx": "1600", "dy": "900", "grid": "1", "gridSize": "10", "guides": "1",
        "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
        "pageScale": "1", "pageWidth": str(page_width), "pageHeight": str(page_height),
        "math": "0", "shadow": "0",
    })
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    for index, (parent, child, label, cardinality) in enumerate(RELATIONS):
        end_marker = {"1": "ERone", "0..1": "ERzeroToOne", "N": "ERzeroToMany"}[cardinality]
        style = (
            "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;"
            "html=1;strokeColor=#52657B;strokeWidth=1.7;fontColor=#172D48;fontSize=14;"
            "labelBackgroundColor=#FFFFFF;startArrow=ERone;startFill=0;startSize=20;"
            f"endArrow={end_marker};endFill=0;endSize=20;"
            "exitPerimeter=1;entryPerimeter=1;" + ports(parent, child, positions)
        )
        cell = ET.SubElement(root, "mxCell", {
            "id": f"relation-{index}", "value": label, "style": style,
            "edge": "1", "parent": "1", "source": f"table-{parent}", "target": f"table-{child}",
        })
        ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})

    for lane in LANES:
        for name, columns in lane:
            x, y, h = positions[name]
            rows = "<br>".join(columns.splitlines())
            value = (
                "<table cellpadding='0' cellspacing='0' style='width:100%;height:100%;font-family:Arial;'>"
                f"<tr style='height:48px'><td align='center' style='font-size:17px;border-bottom:1px solid #111111'><b>{name}</b></td></tr>"
                f"<tr><td align='left' valign='top' style='padding:8px 12px;font-size:13px;line-height:1.35'>{rows}</td></tr>"
                "</table>"
            )
            cell = ET.SubElement(root, "mxCell", {
                "id": f"table-{name}", "value": value,
                "style": "shape=mxgraph.er.entityExt;rounded=1;container=1;collapsible=1;"
                         "buttonText=;subText=;"
                         "whiteSpace=wrap;html=1;overflow=fill;align=left;verticalAlign=top;"
                         "fillColor=#FFFFFF;strokeColor=#111111;strokeWidth=2;"
                         "fontColor=#111111;fontSize=13;shadow=0;",
                "vertex": "1", "parent": "1",
            })
            ET.SubElement(cell, "mxGeometry", {
                "x": str(x), "y": str(y), "width": str(TABLE_WIDTH), "height": str(h), "as": "geometry",
            })
            divider = ET.SubElement(root, "mxCell", {
                "id": f"divider-{name}", "value": "",
                "style": "shape=line;strokeColor=#111111;strokeWidth=2;"
                         "connectable=0;movable=0;resizable=0;rotatable=0;",
                "vertex": "1", "parent": f"table-{name}", "connectable": "0",
            })
            ET.SubElement(divider, "mxGeometry", {
                "x": "0", "y": "48", "width": str(TABLE_WIDTH),
                "height": "1", "as": "geometry",
            })

    ET.ElementTree(mxfile).write(OUTPUT, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {OUTPUT}: 1 canvas, {len(positions)} tables, {len(RELATIONS)} relations")


if __name__ == "__main__":
    main()
