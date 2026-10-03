import conventionalConfig from "@commitlint/config-conventional";

import {
  getStagedFiles,
  validateCommitScope,
} from "./scripts/commit-scope.mjs";

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "scope-from-staged-files": (parsed) =>
          validateCommitScope(parsed.scope, getStagedFiles()),
      },
    },
  ],
  rules: {
    ...conventionalConfig.rules,
    "scope-from-staged-files": [2, "always"],
  },
};
