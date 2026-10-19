"""Regression checks for shared generation; run with python -m unittest discover -s docs."""
import importlib.util
import hashlib
from pathlib import Path
import tempfile
import unittest
from xml.etree import ElementTree as ET

HERE = Path(__file__).resolve().parent

# Captured from both generators before sharing the renderer. Checked-in diagrams
# may have hand-edited viewport/layout metadata, so compare generated output.
CANVAS_SHA256 = {
    (2, False): "e321e6f137ad51e20026e186a35645bbe90ce9072552f9cc6635a4493ab1e4c5",
    (2, True): "e6d7f315351bed054563171bee807b67cedfdb209cccbf4046abde88f86443e8",
    (3, False): "f3bec17ac28df734e4c5847e140dfe402dd2f6ed83e4dc529dc6172eda642966",
    (3, True): "5109d1e6fbeb891e5c225967013de74a216f7cebb73498f53195dd757b43b705",
}


def load_generator(version):
    spec = importlib.util.spec_from_file_location(
        f"model_v{version}", HERE / f"generate_data_models_v{version}.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.generator


class GeneratorRegressionTests(unittest.TestCase):
    def test_versions_have_isolated_data_and_preserve_logical_definitions(self):
        v2 = load_generator(2)
        v3 = load_generator(3)
        v2.validate()
        v3.validate()
        self.assertEqual(v2.TABLES, v3.TABLES)
        self.assertEqual(v2.RELATIONS, v3.RELATIONS)
        self.assertEqual(sum(map(len, v2.CONCEPTS.values())), 36)
        self.assertEqual(sum(map(len, v3.CONCEPTS.values())), 32)
        v3.TABLES["users"] = "changed only in v3"
        self.assertNotEqual(v2.TABLES["users"], v3.TABLES["users"])
        self.assertEqual(v2.VERSION, 2)

    def test_generated_artifacts_match_reviewed_models(self):
        for version in (2, 3):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as output:
                generator = load_generator(version)
                generator.HERE = Path(output)
                for conceptual in (True, False):
                    xml = ET.Element("mxfile")
                    generator.make_canvas(xml, conceptual)
                    digest = hashlib.sha256(ET.tostring(xml)).hexdigest()
                    self.assertEqual(
                        digest, CANVAS_SHA256[(version, conceptual)]
                    )
                    generator.write_model(conceptual)
                generator.write_field_catalog()
                name = f"SkillHub_Entities_Fields_v{version}.md"
                self.assertEqual(
                    (generator.HERE / name).read_text(encoding="utf-8"),
                    (HERE / name).read_text(encoding="utf-8"),
                )


if __name__ == "__main__":
    unittest.main()
