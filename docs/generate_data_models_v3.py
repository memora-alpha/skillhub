"""Generate SkillHub v3 models using the shared catalog and renderer.

The generator instance is isolated so importing v2 and v3 together is safe.
"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "skillhub_model_v3", Path(__file__).with_name("data_model_generator.py")
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
generator.VERSION = 3
generator.CONCEPTUAL_ASSOCIATIONS = {
    "role_permissions", "sharing_skills", "user_learned_skills", "material_entitlements"
}
generator.CONCEPTS = generator.OrderedDict(
    (domain, [name for name in names if name not in generator.CONCEPTUAL_ASSOCIATIONS])
    for domain, names in generator.CONCEPTS.items()
)
generator.CONCEPTUAL_EXTRA_RELATIONS = [
    ("roles", "permissions", "grants", "0..N", "0..N"),
    ("users", "skills", "offers (level/status)", "0..N", "0..N"),
    ("users", "skills", "learned after path completion", "0..N", "0..N"),
    ("users", "materials", "has access (FREE/PURCHASE)", "0..N", "0..N"),
    ("users", "skill_verifications", "submits offered skill for verification", "1", "0..N"),
    ("skills", "skill_verifications", "subject of verification", "1", "0..N"),
    ("users", "skill_evidence", "provides evidence", "1", "0..N"),
    ("skills", "skill_evidence", "supported by evidence", "1", "0..N"),
]


def __getattr__(name):
    return getattr(generator, name)


if __name__ == "__main__":
    generator.main()
