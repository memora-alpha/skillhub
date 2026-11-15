import { closeSync, openSync, readFileSync } from "node:fs";
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
  "test:files:integration",
  "test:learning-request",
  "test:skills",
  "test:report-support",
  "test:learning-paths",
  "test:materials",
  "test:materials:integration",
  "test:public-reviews",
  "test:admin-finance",
  "test:admin-operations",
  "test:admin-operations:integration",
  "test:completion-gaps",
  "test:completion-gaps:integration",
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
const report = join(
  tmpdir(),
  `skillhub-connections-regressions-${process.pid}.tap`,
);
files.push("test/runtime-v3-repositories.test.mjs");
// Build must finish first: Nest cleans dist, so running build during these imports is unsafe.
// Stream TAP to disk because the combined integration catalog exceeds child-process buffers.
const reportDescriptor = openSync(report, "w");
let result;
try {
  result = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=2", ...files],
    {
      stdio: ["ignore", reportDescriptor, reportDescriptor],
    },
  );
} finally {
  closeSync(reportDescriptor);
}
const output = readFileSync(report, "utf8");
if (result.status !== 0) {
  if (result.error) console.error(result.error);
  console.error(
    `Regression process failed with status ${result.status ?? "unknown"} and signal ${result.signal ?? "none"}`,
  );
  const lines = output.split(/\r?\n/);
  const failureBlocks = lines.flatMap((line, index) =>
    /^\s*not ok/u.test(line) ? lines.slice(index, index + 30) : [],
  );
  const summary = lines.filter((line) =>
    /^# (tests|pass|fail|cancelled|skipped|duration_ms)/u.test(line),
  );
  console.log([...failureBlocks, ...summary].join("\n"));
  console.log(`Full test output: ${report}`);
} else {
  console.log(
    output
      .split(/\r?\n/)
      .filter((line) =>
        /^# (tests|pass|fail|skipped|duration_ms|ADMIN_QUERY_PLAN)|^\s*not ok/.test(
          line,
        ),
      )
      .join("\n"),
  );
}
process.exit(result.status ?? 1);
