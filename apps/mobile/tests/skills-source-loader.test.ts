import assert from "node:assert/strict";
import test from "node:test";
import { sourceModule } from "./skills-read-harness";

test("source harness rejects paths outside its fixed module list before loading them", () => {
  for (const path of [
    "../../../../.env",
    "../profile/mocks/public-profiles.ts",
    "hooks/../hooks/use-private-skill-query.ts",
    "file:///tmp/source.ts",
    "https://example.test/source.ts",
    "node:fs",
    "__proto__",
  ])
    assert.throws(() => sourceModule(path, {}), /Source module is not allowed/);
});

test("source harness does not fall back to the host module loader for unmocked imports", () => {
  assert.throws(
    () => sourceModule("hooks/use-private-skill-query.ts", {}),
    /Dependency must be explicitly mocked: react/,
  );
  assert.throws(
    () => sourceModule("hooks/use-private-skill-query.ts", { react: {} }),
    /Dependency must be explicitly mocked: ..\/context\/SkillsProvider/,
  );
});
