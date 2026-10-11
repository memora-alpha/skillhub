import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const scripts = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).scripts;
const names = [
  "test:foundation",
  "test:identity",
  "test:rbac",
  "test:consistency",
  "test:audit",
  "test:configuration",
  "test:files",
  "test:learning-request",
  "test:skills",
];
const files = [
  ...new Set(
    names.flatMap((name) =>
      scripts[name]
        .split("node --test ")[1]
        .split(" ")
        .filter((value) => value.endsWith(".mjs")),
    ),
  ),
];
files.push("test/runtime-v3-repositories.test.mjs");
// Build must finish first: Nest cleans dist, so running build during these imports is unsafe.
const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=2", ...files],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);
const report = join(
  tmpdir(),
  `skillhub-connections-regressions-${process.pid}.tap`,
);
const output = (result.stdout ?? "") + (result.stderr ?? "");
writeFileSync(report, output);
console.log(
  output
    .split(/\r?\n/)
    .filter((line) =>
      /^# (tests|pass|fail|skipped|duration_ms)|^not ok/.test(line),
    )
    .join("\n"),
);
if (result.status !== 0) console.log(`Full test output: ${report}`);
process.exit(result.status ?? 1);
