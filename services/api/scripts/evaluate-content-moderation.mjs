import { readFile } from "node:fs/promises";
import { OpenAiModerationClient } from "../dist/modules/content-moderation/infrastructure/openai-moderation.client.js";
import { assessClassification } from "../dist/modules/content-moderation/domain/moderation-policy.js";

if (
  !process.argv.includes("--send-synthetic-fixtures") ||
  !process.env.OPENAI_API_KEY?.trim()
) {
  console.error(
    "Set OPENAI_API_KEY for the approved staging project and pass --send-synthetic-fixtures.",
  );
  process.exit(1);
}

const file = new URL(
  "../test/content-moderation/fixtures/vi-cases.json",
  import.meta.url,
);
const fixtures = JSON.parse(await readFile(file, "utf8"));
const client = new OpenAiModerationClient({
  get: (name, fallback) => process.env[name] ?? fallback,
});
const samples = [];
for (const fixture of fixtures) {
  if (
    fixture.expected === "POLICY_PENDING" ||
    fixture.expected === "CASE_INTAKE"
  )
    continue;
  const started = performance.now();
  try {
    const response = await client.classify(fixture.text);
    const assessment = assessClassification(response);
    samples.push({
      id: fixture.id,
      surface: fixture.surface,
      expected: fixture.expected,
      contextSupplied: false,
      outcome: assessment.outcome,
      reasonCodes: assessment.reasonCodes,
      flaggedCategoryScores: Object.fromEntries(
        Object.entries(response.category_scores).filter(
          ([category]) => response.categories[category],
        ),
      ),
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch {
    samples.push({
      id: fixture.id,
      expected: fixture.expected,
      outcome: "RETRY",
      elapsedMs: Math.round(performance.now() - started),
    });
  }
}
const elapsed = samples
  .map(({ elapsedMs }) => elapsedMs)
  .toSorted((a, b) => a - b);
const p95 = elapsed[Math.ceil(elapsed.length * 0.95) - 1] ?? null;
const falseBlocks = samples.filter(
  ({ expected, outcome, surface }) =>
    expected === "ALLOW" &&
    (outcome === "BLOCK" || (surface === "chat" && outcome === "REVIEW")),
).length;
const missedBlocks = samples.filter(
  ({ expected, outcome }) => expected === "BLOCK" && outcome === "ALLOW",
).length;
console.log(
  JSON.stringify({ p95, falseBlocks, missedBlocks, samples }, null, 2),
);
if (samples.some(({ outcome }) => outcome === "RETRY")) process.exitCode = 1;
