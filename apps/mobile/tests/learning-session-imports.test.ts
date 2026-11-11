import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = ts.readConfigFile(
  path.join(root, "tsconfig.json"),
  ts.sys.readFile,
);
const options = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  root,
).options;

function runtimeDependencies(filename: string) {
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const dependencies: string[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    )
      continue;
    if (
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (
        !clause?.name &&
        clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.every((element) => element.isTypeOnly)
      )
        continue;
    } else {
      if (statement.isTypeOnly) continue;
      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)
      )
        continue;
    }
    const resolvedName = ts.resolveModuleName(
      statement.moduleSpecifier.text,
      filename,
      options,
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    const resolved = resolvedName ? path.resolve(resolvedName) : undefined;
    if (resolved?.startsWith(path.join(root, "src") + path.sep))
      dependencies.push(resolved);
  }
  return dependencies;
}

// Follow local runtime imports/re-exports, rather than merely matching import strings.
// This verifies the source graph, not native Metro startup.
test("schedule reads and session hooks do not load Learning Path or Session screens through barrels", () => {
  for (const entry of [
    "learning-paths/components/schedule-busy-day.tsx",
    "learning-paths/hooks/use-existing-schedule-check.ts",
    "sessions/hooks/use-session-reschedule.ts",
    "sessions/hooks/use-session-context.ts",
    "sessions/hooks/use-session-action.ts",
    "sessions/components/session-attendance-panel.tsx",
    "sessions/components/session-limits-panel.tsx",
    "reports/screens/report-editor-screen.tsx",
  ]) {
    const seen = new Set<string>();
    const pending = [path.join(root, "src/features", entry)];
    while (pending.length) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      pending.push(...runtimeDependencies(current));
    }
    const screens = [...seen]
      .map((file) => path.relative(root, file).split(path.sep).join("/"))
      .filter((file) =>
        /^src\/features\/(learning-paths|sessions)\/screens\//.test(file),
      );
    assert.deepEqual(screens, [], `${entry} unexpectedly loads screens`);
  }
});
