import assert from "node:assert/strict";
import test from "node:test";

import { quoteShellArgument } from "../lint-staged.config.mjs";
import { expectedScopeForFiles, validateCommitScope } from "./commit-scope.mjs";

test("repo-wide changes do not require a scope", () => {
  assert.equal(
    expectedScopeForFiles(["package.json", "apps/mobile/app/a.tsx"]),
    null,
  );
  assert.equal(validateCommitScope(null, ["package.json"])[0], true);
});

test("changes within one workspace require its package scope", () => {
  const files = ["services/api/package.json", "services/api/src/main.ts"];

  assert.equal(expectedScopeForFiles(files), "api");
  assert.equal(validateCommitScope("api", files)[0], true);
  assert.equal(validateCommitScope(null, files)[0], false);
});

test("changes within one module require package/module scope", () => {
  const files = [
    "services/api/src/modules/auth/auth.module.ts",
    "services/api/src/modules/auth/presentation/http/auth.controller.ts",
  ];

  assert.equal(expectedScopeForFiles(files), "api/auth");
  assert.equal(validateCommitScope("api/auth", files)[0], true);
  assert.equal(validateCommitScope("api", files)[0], false);
});

test("changes across modules require only the package scope", () => {
  const files = [
    "services/api/src/modules/auth/auth.module.ts",
    "services/api/src/modules/users/users.module.ts",
  ];

  assert.equal(expectedScopeForFiles(files), "api");
  assert.equal(validateCommitScope("api", files)[0], true);
});

test("unknown package scopes are rejected", () => {
  assert.equal(validateCommitScope("unknown", ["README.md"])[0], false);
  assert.equal(validateCommitScope("api/unknown", ["README.md"])[0], false);
  assert.equal(validateCommitScope("api/auth/extra", ["README.md"])[0], false);
});

test("shell arguments escape quotes and command substitutions", () => {
  assert.equal(
    quoteShellArgument("src/user's $(touch injected).ts"),
    `'src/user'\\''s $(touch injected).ts'`,
  );
});
