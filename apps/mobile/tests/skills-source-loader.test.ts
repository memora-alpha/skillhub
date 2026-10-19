import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { sourceModule } from "./skills-read-harness";

const queryModulePath = "hooks/use-private-skill-query.ts";
const local = createRequire(import.meta.url);

function queryMocks(current = true) {
  return {
    react: {
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
        snapshot(),
    },
    "../context/SkillsProvider": {
      useSkills: () => ({
        isCurrent: () => current,
        privateReads: {
          subscribe() {},
          snapshot: () => 0,
          denied: () => undefined,
        },
      }),
    },
  };
}

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
    () => sourceModule(queryModulePath, {}),
    /Dependency must be explicitly mocked: react/,
  );
  assert.throws(
    () => sourceModule(queryModulePath, { react: {} }),
    /Dependency must be explicitly mocked: ..\/context\/SkillsProvider/,
  );
});

test("standard module loading keeps per-load dependencies and restores host React", () => {
  const original = local("react");
  const active = sourceModule(queryModulePath, queryMocks());
  const expired = sourceModule(queryModulePath, queryMocks(false));
  const query = { data: "allowed", error: null };
  assert.equal(local("react"), original);
  assert.equal(
    (active.usePrivateSkillQuery!([], query) as { data?: string }).data,
    "allowed",
  );
  assert.equal(
    (expired.usePrivateSkillQuery!([], query) as { data?: string }).data,
    undefined,
  );
});

test("a failed module import restores mocks so the next load and host imports work", () => {
  const original = local("react/jsx-runtime");
  const failing: Record<string, unknown> = {};
  for (const name of [
    "expo-router",
    "@/components/EmptyState",
    "@/features/auth",
    "@/features/skills",
    "../components/ProfileLayout",
    "../components/ProfileSummary",
    "../components/ProfilePrimitives",
    "../context/ProfilePreview",
    "../utils/public-profile",
    "./public-api-profile-screen",
  ])
    failing[name] = {};
  failing["react-native"] = {
    StyleSheet: {
      create() {
        throw new Error("fixture import failure");
      },
    },
  };
  assert.throws(
    () =>
      sourceModule(
        "../profile/screens/public-profile-preview-screen.tsx",
        failing,
      ),
    /fixture import failure/,
  );
  assert.equal(local("react/jsx-runtime"), original);
  const recovered = sourceModule(queryModulePath, queryMocks());
  assert.equal(
    (
      recovered.usePrivateSkillQuery!([], {
        data: "recovered",
        error: null,
      }) as {
        data?: string;
      }
    ).data,
    "recovered",
  );
});
