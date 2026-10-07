"""Generate SkillHub v2 models using the shared catalog and renderer.

The generator instance is isolated so importing v2 and v3 together is safe.
"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "skillhub_model_v2", Path(__file__).with_name("data_model_generator.py")
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
generator.VERSION = 2


def __getattr__(name):
    return getattr(generator, name)


if __name__ == "__main__":
    generator.main()
