"""Generate one-canvas SkillHub conceptual model for diagrams.net."""

from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

OUTPUT = Path(__file__).with_name("SkillHub_Conceptual_Data_Model.drawio")

# Deliberate spacing leaves room for relationship names on connectors.
NODES = {
    "Role": (80, 90), "RolePermission": (80, 230),
    "Permission": (80, 370), "UserRole": (80, 510),
    "OtpChallenge": (80, 700), "OAuthAccount": (80, 840),
    "RefreshSession": (80, 980),
    "Profile": (430, 250), "User": (430, 510),
    "Notification": (430, 700), "ReputationHistory": (430, 840),
    "AuditLog": (430, 980), "SystemConfiguration": (430, 1120),
    "SkillCategory": (780, 90), "Skill": (780, 230),
    "SharingSkill": (780, 370), "SkillVerification": (780, 510),
    "SkillEvidence": (780, 650), "UserLearnedSkill": (780, 790),
    "LearningRequest": (1130, 230), "Proposal": (1130, 370),
    "Conversation": (1130, 510), "Message": (1130, 650),
    "ScheduleProposal": (1130, 790), "ScheduleItem": (1130, 930),
    "ReportDispute": (1480, 370), "Review": (1480, 510),
    "Session": (1480, 790), "SessionConfirmation": (1480, 930),
    "LiveKitRoom": (1480, 1070), "SessionAttendance": (1480, 1210),
    "Payment": (1830, 230), "CreditWallet": (1830, 510),
    "CreditTransaction": (1830, 650), "Withdrawal": (1830, 790),
    "HeldCreditAllocation": (1830, 930),
}

# Source, target, relation name, source cardinality, target cardinality.
# ERone / ERzeroToOne / ERmany / ERzeroToMany are draw.io crow's-foot markers.
EDGES = [
    ("User", "Profile", "has profile", "ERone", "ERone"),
    ("User", "UserRole", "is assigned", "ERone", "ERmany"),
    ("Role", "UserRole", "is assigned through", "ERone", "ERmany"),
    ("Role", "RolePermission", "grants through", "ERone", "ERmany"),
    ("Permission", "RolePermission", "belongs to", "ERone", "ERmany"),
    ("User", "OtpChallenge", "receives", "ERone", "ERzeroToMany"),
    ("User", "OAuthAccount", "links", "ERone", "ERzeroToMany"),
    ("User", "RefreshSession", "owns", "ERone", "ERzeroToMany"),
    ("SkillCategory", "Skill", "groups", "ERone", "ERzeroToMany"),
    ("User", "SharingSkill", "offers", "ERone", "ERzeroToMany"),
    ("Skill", "SharingSkill", "is shared as", "ERone", "ERzeroToMany"),
    ("SharingSkill", "SkillVerification", "is submitted for", "ERone", "ERzeroToMany"),
    ("SkillVerification", "SkillEvidence", "contains", "ERone", "ERmany"),
    ("User", "UserLearnedSkill", "achieves", "ERone", "ERzeroToMany"),
    ("Skill", "UserLearnedSkill", "is learned as", "ERone", "ERzeroToMany"),
    ("User", "LearningRequest", "posts", "ERone", "ERzeroToMany"),
    ("Skill", "LearningRequest", "is requested in", "ERone", "ERzeroToMany"),
    ("LearningRequest", "Proposal", "receives", "ERone", "ERzeroToMany"),
    ("User", "Proposal", "submits", "ERone", "ERzeroToMany"),
    ("Proposal", "Conversation", "opens when accepted", "ERone", "ERzeroToOne"),
    ("User", "Conversation", "participates in", "ERone", "ERzeroToMany"),
    ("Conversation", "Message", "contains", "ERone", "ERzeroToMany"),
    ("Conversation", "ScheduleProposal", "negotiates", "ERone", "ERzeroToMany"),
    ("Proposal", "ScheduleProposal", "is detailed by", "ERone", "ERzeroToMany"),
    ("ScheduleProposal", "ScheduleItem", "contains", "ERone", "ERmany"),
    ("ScheduleItem", "Session", "becomes when locked", "ERone", "ERzeroToOne"),
    ("User", "Session", "participates in", "ERone", "ERzeroToMany"),
    ("Session", "SessionConfirmation", "requires", "ERone", "ERmany"),
    ("Session", "LiveKitRoom", "uses", "ERone", "ERzeroToOne"),
    ("Session", "SessionAttendance", "records", "ERone", "ERzeroToMany"),
    ("Session", "HeldCreditAllocation", "reserves for both users", "ERone", "ERmany"),
    ("User", "HeldCreditAllocation", "commits credit", "ERone", "ERzeroToMany"),
    ("User", "CreditWallet", "owns", "ERone", "ERone"),
    ("CreditWallet", "CreditTransaction", "records", "ERone", "ERzeroToMany"),
    ("User", "Payment", "initiates", "ERone", "ERzeroToMany"),
    ("Payment", "CreditTransaction", "credits through", "ERone", "ERzeroToOne"),
    ("User", "Withdrawal", "requests", "ERone", "ERzeroToMany"),
    ("Session", "Review", "is reviewed in", "ERone", "ERzeroToMany"),
    ("User", "Review", "writes", "ERone", "ERzeroToMany"),
    ("User", "Review", "receives", "ERone", "ERzeroToMany"),
    ("User", "ReputationHistory", "accumulates", "ERone", "ERzeroToMany"),
    ("User", "ReportDispute", "files", "ERone", "ERzeroToMany"),
    ("Session", "ReportDispute", "may be disputed in", "ERone", "ERzeroToMany"),
    ("ReportDispute", "CreditTransaction", "may resolve through", "ERzeroToOne", "ERzeroToMany"),
    ("User", "Notification", "receives", "ERone", "ERzeroToMany"),
    ("User", "AuditLog", "acts in", "ERone", "ERzeroToMany"),
    ("SystemConfiguration", "AuditLog", "changes are logged in", "ERone", "ERzeroToMany"),
]

BOX_WIDTH = 240
BOX_HEIGHT = 62


def ports(source, target):
    sx, sy = NODES[source]
    tx, ty = NODES[target]
    dx, dy = tx - sx, ty - sy
    if abs(dx) >= abs(dy):
        if dx >= 0:
            return "exitX=1;exitY=0.5;entryX=0;entryY=0.5;exitPerimeter=1;entryPerimeter=1;"
        return "exitX=0;exitY=0.5;entryX=1;entryY=0.5;exitPerimeter=1;entryPerimeter=1;"
    if dy >= 0:
        return "exitX=0.5;exitY=1;entryX=0.5;entryY=0;exitPerimeter=1;entryPerimeter=1;"
    return "exitX=0.5;exitY=0;entryX=0.5;entryY=1;exitPerimeter=1;entryPerimeter=1;"


def main():
    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net", "modified": datetime.now(timezone.utc).isoformat(),
        "agent": "Codex", "version": "24.7.17", "type": "device",
    })
    diagram = ET.SubElement(mxfile, "diagram", {
        "id": "skillhub-conceptual", "name": "SkillHub Conceptual Data Model",
    })
    model = ET.SubElement(diagram, "mxGraphModel", {
        "dx": "1600", "dy": "900", "grid": "1", "gridSize": "10", "guides": "1",
        "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
        "pageScale": "1", "pageWidth": "2180", "pageHeight": "1400", "math": "0", "shadow": "0",
    })
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    # Draw connectors first so entity boxes stay in the foreground.
    for i, (source, target, label, source_marker, target_marker) in enumerate(EDGES):
        style = (
            "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;"
            "html=1;strokeColor=#64748B;strokeWidth=1.4;fontColor=#20334D;fontSize=12;"
            "labelBackgroundColor=#FFFFFF;labelBorderColor=none;"
            f"startArrow={source_marker};startFill=0;startSize=18;"
            f"endArrow={target_marker};endFill=0;endSize=18;" + ports(source, target)
        )
        cell = ET.SubElement(root, "mxCell", {
            "id": f"edge-{i}", "value": label, "style": style, "edge": "1",
            "parent": "1", "source": f"entity-{source}", "target": f"entity-{target}",
        })
        ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})

    for name, (x, y) in NODES.items():
        cell = ET.SubElement(root, "mxCell", {
            "id": f"entity-{name}", "value": name,
            "style": "shape=mxgraph.er.entity;buttonStyle=rect;buttonText=;"
                     "whiteSpace=wrap;html=1;align=center;verticalAlign=middle;"
                     "fillColor=#FFFFFF;strokeColor=#3F668F;strokeWidth=1.8;"
                     "fontColor=#162D47;fontSize=16;fontStyle=1;shadow=0;",
            "vertex": "1", "parent": "1",
        })
        ET.SubElement(cell, "mxGeometry", {
            "x": str(x), "y": str(y), "width": str(BOX_WIDTH),
            "height": str(BOX_HEIGHT), "as": "geometry",
        })

    ET.ElementTree(mxfile).write(OUTPUT, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {OUTPUT}: 1 canvas, {len(NODES)} entities, {len(EDGES)} relationships")


if __name__ == "__main__":
    main()
