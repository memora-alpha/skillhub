import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const targets = {
  text: 1000,
  image_under_1mb: 5000,
  image_1_to_5mb: 10000,
  txt: 5000,
  docx: 10000,
  pdf_text: 15000,
  pdf_scan_5_to_10: 30000,
  pdf_scan_20_to_50: 120000,
  cache_hit: 500,
  queue_wait: 500,
  realtime_dispatch: 500,
  image_metadata: 200,
};

export function summarize(samples) {
  const groups = new Map(Object.keys(targets).map((group) => [group, []]));
  for (const sample of samples) {
    const { group, durationMs, outcome } = sample;
    if (
      !groups.has(group) ||
      !Number.isFinite(durationMs) ||
      durationMs < 0 ||
      !["success", "timeout", "failure", "unsupported"].includes(outcome)
    )
      throw new Error("Invalid moderation benchmark sample");
    groups.get(group).push(sample);
  }
  return Object.entries(targets).map(([group, target]) => {
    const rows = groups.get(group);
    const successful = rows.filter(({ outcome }) => outcome === "success");
    const durations = successful
      .map(({ durationMs }) => durationMs)
      .sort((a, b) => a - b);
    const percentile = (p) =>
      durations[Math.ceil(durations.length * p) - 1] ?? null;
    const p95 = percentile(0.95);
    return {
      group,
      target,
      count: rows.length,
      p50: percentile(0.5),
      p95,
      p99: percentile(0.99),
      timeouts: rows.filter(({ outcome }) => outcome === "timeout").length,
      failures: rows.filter(({ outcome }) => outcome === "failure").length,
      unsupported: rows.filter(({ outcome }) => outcome === "unsupported")
        .length,
      reached:
        successful.length > 0 &&
        successful.length === rows.length &&
        p95 <= target,
    };
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [baseline, candidate] = process.argv.slice(2);
  if (!baseline || !candidate)
    throw new Error(
      "Usage: node scripts/benchmark-chat-moderation.mjs baseline.jsonl candidate.jsonl",
    );
  for (const path of [baseline, candidate]) {
    const rows = (await readFile(path, "utf8"))
      .split(/\r?\n/u)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const result = summarize(rows);
    console.log(path);
    console.table(result);
    if (path === candidate && result.some(({ reached }) => !reached))
      process.exitCode = 1;
  }
}
