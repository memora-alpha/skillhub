import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../src/", import.meta.url));
const sourceExtensions = new Set([".ts", ".tsx"]);
const errors = [];

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(rootPath).filter((path) =>
  sourceExtensions.has(path.slice(path.lastIndexOf("."))),
);

for (const path of files) {
  const normalized = relative(rootPath, path).split(sep).join("/");
  const source = readFileSync(path, "utf8");
  const lines = source.split(/\r?\n/).length;
  const limit = normalized.startsWith("app/")
    ? 100
    : /\/(hooks|utils|api|schemas)\//.test(`/${normalized}`)
      ? 250
      : 400;

  if (lines > limit)
    errors.push(`${normalized}: ${lines} lines (limit ${limit})`);

  const privateFeatureImport = source.match(/["']@\/features\/[^/"']+\//);
  if (privateFeatureImport) {
    errors.push(`${normalized}: import features through their public index.ts`);
  }
}

const featuresPath = join(rootPath, "features");
for (const name of readdirSync(featuresPath)) {
  const path = join(featuresPath, name);
  if (statSync(path).isDirectory() && !existsSync(join(path, "index.ts"))) {
    errors.push(`features/${name}: missing public index.ts`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Structure check passed for ${files.length} source files.`);
}
